import { DOMAINS, GATE_TEXT, ITEMS, type DomainCode, type Gate, type RiskItem } from "./registry";

/**
 * ClearView scoring engine: Atlas v2.1 formulas as pure, deterministic functions.
 * Deviations from the Atlas are listed in docs/CLEARVIEW_INTEGRATION.md (section "Что исправить в методологии") and
 * are switchable through `options` so the original behaviour stays reproducible.
 */

// ── tiers ────────────────────────────────────────────────────────────────────────────────────────
export type Tier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CAUTION" | "REJECT";
export const TIER_RU: Record<Tier, { label: string; hint: string }> = {
  PLATINUM: { label: "Платина", hint: "Институциональный уровень" },
  GOLD: { label: "Золото", hint: "Можно инвестировать" },
  SILVER: { label: "Серебро", hint: "Можно инвестировать с осторожностью" },
  BRONZE: { label: "Бронза", hint: "Только на условиях" },
  CAUTION: { label: "Повышенный риск", hint: "Нужна консультация специалиста" },
  REJECT: { label: "Не рекомендуется", hint: "Недопустимый риск или сработало стоп-условие" },
};
export function tierOf(score: number): Tier {
  if (score >= 92) return "PLATINUM";
  if (score >= 80) return "GOLD";
  if (score >= 70) return "SILVER";
  if (score >= 60) return "BRONZE";
  if (score >= 40) return "CAUTION";
  return "REJECT";
}
const TIER_ORDER: Tier[] = ["REJECT", "CAUTION", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
const capTier = (t: Tier, max: Tier): Tier => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(max) ? max : t);

// ── dynamic weights ──────────────────────────────────────────────────────────────────────────────
export type Stage = "prelaunch" | "early" | "mid" | "late" | "completed";
export type ProjectKind = "condo_leasehold" | "villa_company" | "villa_usufruct" | "mixed_hotel" | "rental_pool" | "branded";
export type BuyerProfile = "investor" | "personal" | "capital_preservation";
type Mod = Partial<Record<DomainCode, number>>;

const STAGE_MOD: Record<Stage, Mod> = {
  prelaunch: { D2: 6, D3: 4, D1: 2, D4: -6, D6: -3, D7: -3 },
  early: {},
  mid: { D4: 5, D5: 2, D2: -4, D1: -3 },
  late: { D4: 8, D5: 3, D2: -5, D1: -3, D7: -3 },
  completed: { D5: 5, D4: 3, D7: 1, D8: 1, D1: -5, D2: -5 },
};
const KIND_MOD: Record<ProjectKind, Mod> = {
  condo_leasehold: { D3: 3, D5: 2, D2: -3, D6: -2 },
  villa_company: { D3: 5, D1: 2, D2: -4, D6: -3 },
  villa_usufruct: { D3: 4, D5: 3, D2: -4, D6: -3 },
  mixed_hotel: { D6: 4, D8: 2, D3: 2, D1: -4, D7: -4 },
  rental_pool: { D9: 4, D7: -2, D8: -2 },
  branded: { D9: 8, D7: -2, D6: -4, D1: -2 },
};
const BUYER_MOD: Record<BuyerProfile, Mod> = {
  investor: { D6: 4, D7: 2, D1: -3, D8: -3 },
  personal: { D8: 4, D5: 3, D6: -5, D7: -2 },
  capital_preservation: { D3: 3, D2: 3, D6: -3, D7: -3 },
};

export interface Scope {
  stage: Stage;
  kinds?: ProjectKind[];
  rentalThesis?: "none" | "str" | "ltr";
  isBranded?: boolean;
  /** Personalised lens only: the OFFICIAL rating must not use it (otherwise one project has many scores). */
  buyerProfile?: BuyerProfile;
}
export interface Options {
  /** Atlas v2.1 has no floor: stacked modifiers can push a weight below zero. Default floor: 25% of the base weight. */
  weightFloorShare?: number;
  /** Atlas: an evidence-less gate field auto-triggers. Default here: the case is "incomplete" (the developer can still supply it). */
  gateUnknown?: "incomplete" | "auto_trigger";
  /**
   * "atlas": domainScore = 100 x (1 - risk / 37.5), exactly as published. Measured range of the composite is about 41..91,
   * so PLATINUM (92+) is unreachable and "everything bad" never falls below CAUTION.
   * "stretched": risk is normalised between the best case (every risk absent, registry-verified) and the worst case
   * (every risk present, undocumented) of the same domain, so the full 0..100 range is usable. Needs benchmark calibration.
   */
  calibration?: "atlas" | "stretched";
}

export function adjustWeights(scope: Scope, opts: Options = {}): { weights: Record<DomainCode, number>; floored: DomainCode[] } {
  const floor = opts.weightFloorShare ?? 0.25;
  const raw = {} as Record<DomainCode, number>;
  for (const d of DOMAINS) raw[d.code] = d.base * 100;
  const apply = (m: Mod) => { for (const [k, v] of Object.entries(m)) raw[k as DomainCode] += v as number; };
  apply(STAGE_MOD[scope.stage]);
  for (const k of scope.kinds ?? []) apply(KIND_MOD[k]);
  if (scope.isBranded && !(scope.kinds ?? []).includes("branded")) apply(KIND_MOD.branded);
  if (scope.buyerProfile) apply(BUYER_MOD[scope.buyerProfile]);
  const floored: DomainCode[] = [];
  let sum = 0;
  for (const d of DOMAINS) {
    const min = d.base * 100 * floor;
    if (raw[d.code] < min) { floored.push(d.code); raw[d.code] = min; }
    sum += raw[d.code];
  }
  const weights = {} as Record<DomainCode, number>;
  for (const d of DOMAINS) weights[d.code] = raw[d.code] / sum;
  return { weights, floored };
}

// ── item scoring ─────────────────────────────────────────────────────────────────────────────────
export type EvidenceClass = "registry" | "contract" | "independent_report" | "developer" | "broker" | "analyst" | "expired" | "missing";
export const EVIDENCE_C: Record<EvidenceClass, number> = {
  registry: 0.9, contract: 0.9, independent_report: 0.9, developer: 1.0, broker: 1.25, analyst: 1.25, expired: 1.4, missing: 1.3,
};
export type Mitigation = "full" | "substantial" | "partial" | "none" | "worse";
export const MITIGATION_M: Record<Mitigation, number> = { full: 0.5, substantial: 0.75, partial: 0.85, none: 1.0, worse: 1.3 };

export interface ItemInput {
  P?: number; S?: number; O?: number; M?: number; C?: number;
  /** The analyst or the rubric has explicitly judged this item (counts towards completeness). */
  judged?: boolean;
}

/** Probability when the risk is claimed absent: a developer's word is not a verified fact. */
const ABSENT_P: Record<EvidenceClass, number | null> = {
  registry: 1, contract: 1, independent_report: 1, developer: 2, broker: 3, analyst: 3, expired: 3, missing: null,
};

/** Atlas step 1 and 2. */
export function residualRisk(item: RiskItem, x: ItemInput = {}): number {
  const P = x.P ?? item.P, S = x.S ?? item.S, O = x.O ?? item.O;
  const raw = P * S * (1 + (O - 1) / 8);
  return raw * (x.M ?? 1) * (x.C ?? 1);
}

export type ItemState = "absent" | "present" | "partial" | "unknown";
/**
 * PROPOSED rubric (not in the Atlas): turns an observable fact into P/O/M/C, so two analysts, or the engine, get the
 * same number from the same evidence. Constants are calibration candidates.
 */
export function fromState(item: RiskItem, state: ItemState, evidence: EvidenceClass, mitigation: Mitigation = "none"): ItemInput {
  const C = EVIDENCE_C[evidence];
  const direct = evidence === "registry" || evidence === "contract" || evidence === "independent_report";
  switch (state) {
    case "absent": return { P: ABSENT_P[evidence] ?? item.P, O: direct ? 1 : item.O, M: 1, C, judged: true };
    case "present": return { P: 5, O: item.O, M: MITIGATION_M[mitigation], C, judged: true };
    case "partial": return { P: Math.min(5, item.P + 1), O: item.O, M: MITIGATION_M[mitigation], C, judged: true };
    default: return { C: EVIDENCE_C.missing, judged: false };
  }
}

// ── applicability ────────────────────────────────────────────────────────────────────────────────
const RENTAL_ITEMS = new Set(["9.1", "9.3", "9.4", "9.5", "9.6"]);
export function applies(item: RiskItem, scope: Scope): boolean {
  if (item.branded) return !!scope.isBranded || (scope.kinds ?? []).includes("branded");
  const thesis = scope.rentalThesis ?? "none";
  if (item.code === "6.4") return thesis === "str";
  if (item.code === "6.5" || item.code === "6.6") return thesis === "ltr";
  if (RENTAL_ITEMS.has(item.code)) return thesis !== "none";
  return true;
}

// ── assessment ───────────────────────────────────────────────────────────────────────────────────
export interface Facts {
  d1ReputationFail?: boolean;
  d2ConfirmedRedFlags?: boolean;
  d4Halt90?: boolean;
  /** Platinum auto-qualification (Atlas section 7). */
  platinum?: { eiaConfirmed: boolean; permitConfirmed: boolean; quotaUsedPct: number; escrowActive: boolean; noCourtAction: boolean; noFloodRisk: boolean };
}
export interface AssessmentInput {
  scope: Scope;
  items: Record<string, ItemInput | undefined>;
  gates?: Partial<Record<Gate, "clear" | "triggered" | "unknown">>;
  facts?: Facts;
  options?: Options;
}
export interface Assessment {
  status: "rated" | "rejected" | "incomplete";
  tier: Tier | null;
  composite: number | null;
  domainScores: Record<DomainCode, number>;
  weights: Record<DomainCode, number>;
  flooredWeights: DomainCode[];
  gatesTriggered: Gate[];
  gatesUnknown: Gate[];
  capsApplied: string[];
  completeness: number;
  dataConfidence: "high" | "medium" | "low";
}

const NORMALISER = 37.5; // max rawRisk (5 x 5 x 1.5)

export function domainScore(domain: DomainCode, input: AssessmentInput): number {
  let num = 0, den = 0, best = 0, worst = 0;
  for (const item of ITEMS) {
    if (item.domain !== domain || !applies(item, input.scope)) continue;
    num += residualRisk(item, input.items[item.code]) * item.weight;
    best += residualRisk(item, { P: 1, O: 1, M: 1, C: EVIDENCE_C.registry }) * item.weight;
    worst += residualRisk(item, { P: 5, M: 1, C: EVIDENCE_C.missing }) * item.weight;
    den += item.weight;
  }
  if (!den) return 100;
  const risk = num / den;
  if (input.options?.calibration === "stretched") {
    const lo = best / den, hi = worst / den;
    return Math.max(0, Math.min(100, 100 * (1 - (risk - lo) / (hi - lo))));
  }
  return Math.max(0, Math.min(100, 100 * (1 - risk / NORMALISER)));
}

export function assess(input: AssessmentInput): Assessment {
  const { weights, floored } = adjustWeights(input.scope, input.options);
  const gateMode = input.options?.gateUnknown ?? "incomplete";
  const triggered: Gate[] = [];
  const unknown: Gate[] = [];
  for (const g of Object.keys(GATE_TEXT) as Gate[]) {
    // G10 only concerns an STR rental-pool thesis.
    if (g === "G10" && input.scope.rentalThesis !== "str") continue;
    const s = input.gates?.[g] ?? "unknown";
    if (s === "triggered") triggered.push(g);
    else if (s === "unknown") unknown.push(g);
  }
  if (gateMode === "auto_trigger") triggered.push(...unknown.splice(0));

  const applicable = ITEMS.filter((it) => applies(it, input.scope));
  const judged = applicable.filter((it) => input.items[it.code]?.judged).length;
  const completeness = applicable.length ? judged / applicable.length : 0;
  const dataConfidence = completeness >= 0.85 ? "high" : completeness >= 0.6 ? "medium" : "low";

  const domainScores = {} as Record<DomainCode, number>;
  for (const d of DOMAINS) domainScores[d.code] = domainScore(d.code, input);

  const caps: string[] = [];
  const cap = (d: DomainCode, max: number, why: string) => {
    if (domainScores[d] > max) { domainScores[d] = max; caps.push(`${d} ≤ ${max}: ${why}`); }
  };
  if (input.facts?.d2ConfirmedRedFlags) cap("D2", 20, "confirmed financing red flags");
  if (input.facts?.d4Halt90) cap("D4", 20, "construction halted 90+ days");
  for (const it of applicable) if (it.cap && input.items[it.code]?.P === 5) cap(it.cap.domain, it.cap.max, it.title);

  const base = { domainScores, weights, flooredWeights: floored, gatesTriggered: triggered, gatesUnknown: unknown, capsApplied: caps, completeness, dataConfidence } as const;

  if (triggered.length || input.facts?.d1ReputationFail) {
    return { status: "rejected", tier: "REJECT", composite: null, ...base };
  }
  if (unknown.length) return { status: "incomplete", tier: null, composite: null, ...base };

  let composite = 0;
  for (const d of DOMAINS) composite += domainScores[d.code] * weights[d.code];
  composite = Math.round(composite * 10) / 10;

  let tier = tierOf(composite);
  const p = input.facts?.platinum;
  if (tier === "PLATINUM" && !(p && p.eiaConfirmed && p.permitConfirmed && p.quotaUsedPct <= 45 && p.escrowActive && p.noCourtAction && p.noFloodRisk)) {
    tier = "GOLD";
    caps.push("PLATINUM auto-qualification not met: capped at GOLD");
  }
  if (dataConfidence === "low") {
    const capped = capTier(tier, "SILVER");
    if (capped !== tier) { tier = capped; caps.push("Low data confidence: capped at SILVER"); }
  }
  return { status: "rated", tier, composite, ...base };
}

/** What-if: score change if the given items were re-judged (powers the developer "path to Gold"). */
export function whatIf(input: AssessmentInput, changes: Record<string, ItemInput>): { before: number | null; after: number | null; delta: number | null } {
  const before = assess(input).composite;
  const after = assess({ ...input, items: { ...input.items, ...changes } }).composite;
  return { before, after, delta: before != null && after != null ? Math.round((after - before) * 10) / 10 : null };
}
