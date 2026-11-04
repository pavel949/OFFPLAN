import { ATLAS_V21, type CvConfig, type EvidenceClass, type Mitigation, type Mod, type Tier } from "./config";
import type { DomainCode, Gate, RiskItem } from "./registry";

export type { EvidenceClass, Mitigation, Tier } from "./config";

/**
 * ClearView scoring engine: pure, deterministic functions over a methodology configuration (`CvConfig`).
 * With `ATLAS_V21` it reproduces the published Atlas v2.1; `CLEARVIEW_V22` adds the corrections adopted by the owner.
 */

// ── tiers ────────────────────────────────────────────────────────────────────────────────────────
export const TIER_RU: Record<Tier, { label: string; hint: string }> = {
  PLATINUM: { label: "Платина", hint: "Институциональный уровень" },
  GOLD: { label: "Золото", hint: "Можно инвестировать" },
  SILVER: { label: "Серебро", hint: "Можно инвестировать с осторожностью" },
  BRONZE: { label: "Бронза", hint: "Только на условиях" },
  CAUTION: { label: "Повышенный риск", hint: "Нужна консультация специалиста" },
  REJECT: { label: "Не рекомендуется", hint: "Недопустимый риск или сработало стоп-условие" },
};
export const TIER_ORDER: Tier[] = ["REJECT", "CAUTION", "BRONZE", "SILVER", "GOLD", "PLATINUM"];

export function tierOf(score: number, cfg: CvConfig = ATLAS_V21): Tier {
  const t = cfg.tiers;
  if (score >= t.PLATINUM) return "PLATINUM";
  if (score >= t.GOLD) return "GOLD";
  if (score >= t.SILVER) return "SILVER";
  if (score >= t.BRONZE) return "BRONZE";
  if (score >= t.CAUTION) return "CAUTION";
  return "REJECT";
}
const capTier = (t: Tier, max: Tier): Tier => (TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(max) ? max : t);

// ── dynamic weights ──────────────────────────────────────────────────────────────────────────────
export type Stage = keyof CvConfig["stageMod"];
export type ProjectKind = keyof CvConfig["kindMod"];
export type BuyerProfile = keyof CvConfig["buyerMod"];

export interface Scope {
  stage: Stage;
  kinds?: ProjectKind[];
  rentalThesis?: "none" | "str" | "ltr";
  isBranded?: boolean;
  /** Personalised lens only: the OFFICIAL rating must not use it (otherwise one project has many scores). */
  buyerProfile?: BuyerProfile;
}
export interface Options {
  /** Overrides `cfg.weightFloorShare` (negative = no floor, as in Atlas v2.1, where stacked modifiers can push a weight below zero). */
  weightFloorShare?: number;
  /** Atlas: an evidence-less gate field auto-triggers. Default here: the case is "incomplete" (the developer can still supply it). */
  gateUnknown?: "incomplete" | "auto_trigger";
  /** Overrides `cfg.calibration`. */
  calibration?: "atlas" | "stretched";
}

export function adjustWeights(scope: Scope, opts: Options = {}, cfg: CvConfig = ATLAS_V21): { weights: Record<DomainCode, number>; floored: DomainCode[] } {
  const floor = opts.weightFloorShare ?? cfg.weightFloorShare;
  const raw = {} as Record<DomainCode, number>;
  for (const d of cfg.domains) raw[d.code] = d.base * 100;
  const apply = (m: Mod | undefined) => { for (const [k, v] of Object.entries(m ?? {})) raw[k as DomainCode] += v as number; };
  apply(cfg.stageMod[scope.stage]);
  for (const k of scope.kinds ?? []) apply(cfg.kindMod[k]);
  if (scope.isBranded && !(scope.kinds ?? []).includes("branded")) apply(cfg.kindMod.branded);
  if (scope.buyerProfile) apply(cfg.buyerMod[scope.buyerProfile]);
  const floored: DomainCode[] = [];
  let sum = 0;
  for (const d of cfg.domains) {
    const min = d.base * 100 * floor;
    if (floor >= 0 && raw[d.code] < min) { floored.push(d.code); raw[d.code] = min; }
    sum += raw[d.code];
  }
  const weights = {} as Record<DomainCode, number>;
  for (const d of cfg.domains) weights[d.code] = raw[d.code] / sum;
  return { weights, floored };
}

// ── item scoring ─────────────────────────────────────────────────────────────────────────────────
export interface ItemInput {
  P?: number; S?: number; O?: number; M?: number; C?: number;
  /** The analyst or the rubric has explicitly judged this item (counts towards completeness). */
  judged?: boolean;
}

const NORMALISER = 37.5; // max rawRisk (5 x 5 x 1.5)

/** Atlas step 1 and 2. */
export function residualRisk(item: RiskItem, x: ItemInput = {}): number {
  const P = x.P ?? item.P, S = x.S ?? item.S, O = x.O ?? item.O;
  const raw = P * S * (1 + (O - 1) / 8);
  return raw * (x.M ?? 1) * (x.C ?? 1);
}

export type ItemState = "absent" | "present" | "partial" | "unknown";
/**
 * PROPOSED rubric (not in the Atlas): turns an observable fact into P/O/M/C, so two analysts, or the engine, get the
 * same number from the same evidence. A developer's word is not evidence: "absent" claimed by the developer keeps a
 * higher probability than "absent" confirmed by a registry.
 */
export function fromState(item: RiskItem, state: ItemState, evidence: EvidenceClass, mitigation: Mitigation = "none", cfg: CvConfig = ATLAS_V21): ItemInput {
  const C = cfg.evidenceC[evidence];
  const direct = evidence === "registry" || evidence === "contract" || evidence === "independent_report";
  switch (state) {
    case "absent": return { P: cfg.absentP[evidence] ?? item.P, O: direct ? 1 : item.O, M: 1, C, judged: true };
    case "present": return { P: 5, O: item.O, M: cfg.mitigationM[mitigation], C, judged: true };
    case "partial": return { P: Math.min(5, item.P + 1), O: item.O, M: cfg.mitigationM[mitigation], C, judged: true };
    default: return { C: cfg.evidenceC.missing, judged: false };
  }
}

// ── applicability ────────────────────────────────────────────────────────────────────────────────
export function applies(item: RiskItem, scope: Scope): boolean {
  if (item.branded) return !!scope.isBranded || (scope.kinds ?? []).includes("branded");
  const thesis = scope.rentalThesis ?? "none";
  if (item.needs === "str") return thesis === "str";
  if (item.needs === "ltr") return thesis === "ltr";
  if (item.needs === "rental") return thesis !== "none";
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

export function domainScore(domain: DomainCode, input: AssessmentInput, cfg: CvConfig = ATLAS_V21): number {
  let num = 0, den = 0, best = 0, worst = 0;
  for (const item of cfg.items) {
    if (item.domain !== domain || !applies(item, input.scope)) continue;
    num += residualRisk(item, input.items[item.code]) * item.weight;
    best += residualRisk(item, { P: 1, O: 1, M: 1, C: cfg.evidenceC.registry }) * item.weight;
    worst += residualRisk(item, { P: 5, M: 1, C: cfg.evidenceC.missing }) * item.weight;
    den += item.weight;
  }
  if (!den) return 100;
  const risk = num / den;
  if ((input.options?.calibration ?? cfg.calibration) === "stretched") {
    const lo = best / den, hi = worst / den;
    return Math.max(0, Math.min(100, 100 * (1 - (risk - lo) / (hi - lo))));
  }
  return Math.max(0, Math.min(100, 100 * (1 - risk / NORMALISER)));
}

export function assess(input: AssessmentInput, cfg: CvConfig = ATLAS_V21): Assessment {
  const { weights, floored } = adjustWeights(input.scope, input.options, cfg);
  const gateMode = input.options?.gateUnknown ?? "incomplete";
  const triggered: Gate[] = [];
  const unknown: Gate[] = [];
  for (const g of Object.keys(cfg.gates) as Gate[]) {
    // G10 only concerns an STR rental-pool thesis.
    if (g === "G10" && input.scope.rentalThesis !== "str") continue;
    const s = input.gates?.[g] ?? "unknown";
    if (s === "triggered") triggered.push(g);
    else if (s === "unknown") unknown.push(g);
  }
  if (gateMode === "auto_trigger") triggered.push(...unknown.splice(0));

  const applicable = cfg.items.filter((it) => applies(it, input.scope));
  const judged = applicable.filter((it) => input.items[it.code]?.judged).length;
  const completeness = applicable.length ? judged / applicable.length : 0;
  const dataConfidence = completeness >= 0.85 ? "high" : completeness >= 0.6 ? "medium" : "low";

  const domainScores = {} as Record<DomainCode, number>;
  for (const d of cfg.domains) domainScores[d.code] = domainScore(d.code, input, cfg);

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
  for (const d of cfg.domains) composite += domainScores[d.code] * weights[d.code];
  composite = Math.round(composite * 10) / 10;

  let tier = tierOf(composite, cfg);
  const p = input.facts?.platinum;
  if (tier === "PLATINUM" && !(p && p.eiaConfirmed && p.permitConfirmed && p.quotaUsedPct <= 45 && p.escrowActive && p.noCourtAction && p.noFloodRisk)) {
    tier = "GOLD";
    caps.push("PLATINUM auto-qualification not met: capped at GOLD");
  }
  for (const r of cfg.tierCaps) {
    if (domainScores[r.domain] < r.below) {
      const capped = capTier(tier, r.max);
      if (capped !== tier) { tier = capped; caps.push(`${r.domain} below ${r.below}: overall capped at ${r.max}`); }
    }
  }
  if (dataConfidence === "low") {
    const capped = capTier(tier, "SILVER");
    if (capped !== tier) { tier = capped; caps.push("Low data confidence: capped at SILVER"); }
  }
  return { status: "rated", tier, composite, ...base };
}

/** What-if: score change if the given items were re-judged. Exact numbers are for analysts only (they would reveal weights). */
export function whatIf(input: AssessmentInput, changes: Record<string, ItemInput>, cfg: CvConfig = ATLAS_V21): { before: number | null; after: number | null; delta: number | null } {
  const before = assess(input, cfg).composite;
  const after = assess({ ...input, items: { ...input.items, ...changes } }, cfg).composite;
  return { before, after, delta: before != null && after != null ? Math.round((after - before) * 10) / 10 : null };
}
