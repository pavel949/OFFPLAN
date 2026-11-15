import { DOMAINS, GATE_TEXT, ITEMS, type DomainCode, type Gate, type RiskItem } from "./registry";

/**
 * A complete, versionable ClearView methodology. Everything that influences a score lives here (and nowhere else), so a
 * version can be edited, simulated, approved, hashed and pinned to an assessment.
 */
export type Mod = Partial<Record<DomainCode, number>>;
export type EvidenceClass = "registry" | "contract" | "independent_report" | "developer" | "broker" | "analyst" | "expired" | "missing";
export type Mitigation = "full" | "substantial" | "partial" | "none" | "worse";
export type Tier = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE" | "CAUTION" | "REJECT";

export interface QuickOption {
  id: string;
  label: string;
  /** Item states this answer implies. `unknown` means "not known": the item stays unjudged. */
  effects: { item: string; state: "absent" | "present" | "partial" | "unknown" }[];
  gates?: Partial<Record<Gate, "clear" | "triggered">>;
  facts?: { d4Halt90?: boolean };
}
export interface QuickQuestion {
  id: string;
  domain: DomainCode;
  text: string;
  help?: string;
  options: QuickOption[];
  /** Future automation: where an answer could be pre-filled from (catalogue, GIS, registry). */
  autofill?: "catalogue" | "gis" | "registry" | "document";
}

export interface CvConfig {
  schema: 1;
  /** Human version, e.g. "2.2.0". */
  version: string;
  jurisdiction: string;
  title: string;
  domains: { code: DomainCode; name: string; ru: string; base: number }[];
  items: RiskItem[];
  gates: Record<Gate, string>;
  stageMod: Record<"prelaunch" | "early" | "mid" | "late" | "completed", Mod>;
  kindMod: Record<"condo_leasehold" | "villa_company" | "villa_usufruct" | "mixed_hotel" | "rental_pool" | "branded", Mod>;
  buyerMod: Record<"investor" | "personal" | "capital_preservation", Mod>;
  /** Lower bound of each tier, in score points. REJECT is everything below `CAUTION`. */
  tiers: Record<Exclude<Tier, "REJECT">, number>;
  calibration: "atlas" | "stretched";
  /**
   * Overall tier ceilings triggered by a weak domain ("a chain is as strong as its weakest link"). Bible v2.0 had these
   * (legal or developer domain below 60 capped the result); Atlas v2.1 dropped them, so a stalled, unfunded project could
   * still average out at SILVER.
   */
  tierCaps: { domain: DomainCode; below: number; max: Tier }[];
  /** Minimum share of a domain's base weight after modifiers; -1 disables the floor (Atlas v2.1 behaviour). */
  weightFloorShare: number;
  evidenceC: Record<EvidenceClass, number>;
  /** Probability assigned to "risk absent" depending on how well that is evidenced (null = use the item default). */
  absentP: Record<EvidenceClass, number | null>;
  mitigationM: Record<Mitigation, number>;
  quick: QuickQuestion[];
}

const mod = (m: Mod): Mod => m;

/** Atlas v2.1 exactly as published (plus the item `needs` flags): the reference every change is measured against. */
export const ATLAS_V21: CvConfig = {
  schema: 1,
  version: "2.1.0",
  jurisdiction: "TH",
  title: "ClearView Risk Methodology Atlas v2.1 (as published)",
  domains: DOMAINS.map((d) => ({ ...d })),
  items: ITEMS.map((i) => ({ ...i })),
  gates: { ...GATE_TEXT },
  stageMod: {
    prelaunch: mod({ D2: 6, D3: 4, D1: 2, D4: -6, D6: -3, D7: -3 }),
    early: mod({}),
    mid: mod({ D4: 5, D5: 2, D2: -4, D1: -3 }),
    late: mod({ D4: 8, D5: 3, D2: -5, D1: -3, D7: -3 }),
    completed: mod({ D5: 5, D4: 3, D7: 1, D8: 1, D1: -5, D2: -5 }),
  },
  kindMod: {
    condo_leasehold: mod({ D3: 3, D5: 2, D2: -3, D6: -2 }),
    villa_company: mod({ D3: 5, D1: 2, D2: -4, D6: -3 }),
    villa_usufruct: mod({ D3: 4, D5: 3, D2: -4, D6: -3 }),
    mixed_hotel: mod({ D6: 4, D8: 2, D3: 2, D1: -4, D7: -4 }),
    rental_pool: mod({ D9: 4, D7: -2, D8: -2 }),
    branded: mod({ D9: 8, D7: -2, D6: -4, D1: -2 }),
  },
  buyerMod: {
    investor: mod({ D6: 4, D7: 2, D1: -3, D8: -3 }),
    personal: mod({ D8: 4, D5: 3, D6: -5, D7: -2 }),
    capital_preservation: mod({ D3: 3, D2: 3, D6: -3, D7: -3 }),
  },
  tiers: { PLATINUM: 92, GOLD: 80, SILVER: 70, BRONZE: 60, CAUTION: 40 },
  calibration: "atlas",
  tierCaps: [],
  weightFloorShare: -1,
  evidenceC: { registry: 0.9, contract: 0.9, independent_report: 0.9, developer: 1.0, broker: 1.25, analyst: 1.25, expired: 1.4, missing: 1.3 },
  absentP: { registry: 1, contract: 1, independent_report: 1, developer: 2, broker: 3, analyst: 3, expired: 3, missing: null },
  mitigationM: { full: 0.5, substantial: 0.75, partial: 0.85, none: 1.0, worse: 1.3 },
  quick: [],
};

const q = (id: string, domain: DomainCode, text: string, options: QuickOption[], extra: Partial<QuickQuestion> = {}): QuickQuestion => ({ id, domain, text, options, ...extra });
const unk = (...items: string[]): QuickOption => ({ id: "unknown", label: "Не знаю или не проверял(а)", effects: items.map((item) => ({ item, state: "unknown" as const })) });

/** Short self-check wizard (public). Each answer maps to risk-item states; nothing here reveals weights. */
export const QUICK_QUESTIONS: QuickQuestion[] = [
  q("title", "D3", "Какой документ на землю у проекта?", [
    { id: "chanote", label: "Chanote (полный титул)", effects: [{ item: "3.1", state: "absent" }, { item: "3.7", state: "absent" }], gates: { G2: "clear" } },
    { id: "norsor3", label: "Nor Sor 3 или ниже", effects: [{ item: "3.1", state: "absent" }, { item: "3.7", state: "present" }], gates: { G2: "clear" } },
    { id: "sorkor1", label: "Sor Kor 1", effects: [{ item: "3.1", state: "present" }], gates: { G2: "triggered" } },
    unk("3.1", "3.7"),
  ], { help: "Титул определяет, можно ли иностранцу получить право собственности.", autofill: "registry" }),
  q("encumbrance", "D3", "Есть ли ипотека или иное обременение на землю?", [
    { id: "none", label: "Нет, подтверждено выпиской", effects: [{ item: "3.2", state: "absent" }], gates: { G7: "clear" } },
    { id: "yes", label: "Есть", effects: [{ item: "3.2", state: "present" }], gates: { G7: "triggered" } },
    unk("3.2"),
  ], { autofill: "registry" }),
  q("owner", "D3", "Продавец и собственник земли — одно и то же лицо?", [
    { id: "same", label: "Да, это подтверждено", effects: [{ item: "3.4", state: "absent" }, { item: "3.6", state: "absent" }], gates: { G8: "clear", G1: "clear" } },
    { id: "different", label: "Нет, земля принадлежит третьему лицу", effects: [{ item: "3.4", state: "present" }], gates: { G8: "triggered" } },
    unk("3.4", "3.6"),
  ]),
  q("quota", "D3", "Какая доля площадей кондоминиума уже продана иностранцам?", [
    { id: "low", label: "Меньше 40%", effects: [{ item: "3.3", state: "absent" }, { item: "3.8", state: "absent" }], gates: { G6: "clear" } },
    { id: "mid", label: "От 40% до 48%", effects: [{ item: "3.3", state: "absent" }, { item: "3.8", state: "present" }], gates: { G6: "clear" } },
    { id: "full", label: "49% и больше", effects: [{ item: "3.3", state: "present" }], gates: { G6: "triggered" } },
    { id: "na", label: "Это вилла или объект не по квоте", effects: [{ item: "3.3", state: "absent" }, { item: "3.8", state: "absent" }], gates: { G6: "clear" } },
    unk("3.3", "3.8"),
  ], { help: "Квота иностранцев — 49% площади здания.", autofill: "document" }),
  q("permit", "D4", "Есть ли разрешение на строительство?", [
    { id: "yes", label: "Да, номер и дата известны", effects: [{ item: "4.3", state: "absent" }], gates: { G5: "clear" } },
    { id: "no", label: "Нет, но стройка идёт", effects: [{ item: "4.3", state: "present" }], gates: { G5: "triggered" } },
    { id: "prelaunch", label: "Стройка ещё не началась", effects: [{ item: "4.3", state: "absent" }], gates: { G5: "clear" } },
    unk("4.3"),
  ], { autofill: "registry" }),
  q("eia", "D4", "Нужна ли экологическая оценка (EIA) и есть ли она?", [
    { id: "ok", label: "Нужна, одобрена", effects: [{ item: "4.2", state: "absent" }], gates: { G4: "clear" } },
    { id: "notneeded", label: "Не требуется (малый проект, не у берега)", effects: [{ item: "4.2", state: "absent" }], gates: { G4: "clear" } },
    { id: "missing", label: "Нужна, но нет или отозвана", effects: [{ item: "4.2", state: "present" }], gates: { G4: "triggered" } },
    unk("4.2"),
  ], { help: "Требуется для кондо от 80 лотов или 4 000 м², либо в 50 м от берега.", autofill: "gis" }),
  q("escrow", "D2", "Где хранятся платежи покупателей до сдачи?", [
    { id: "escrow", label: "На эскроу или под банковской гарантией", effects: [{ item: "5.1", state: "absent" }, { item: "2.1", state: "absent" }] },
    { id: "developer", label: "На счёте застройщика", effects: [{ item: "5.1", state: "present" }] },
    unk("5.1", "2.1"),
  ], { autofill: "document" }),
  q("frontload", "D2", "Какая доля цены оплачивается до готовности каркаса здания?", [
    { id: "low", label: "40% или меньше", effects: [{ item: "2.1", state: "absent" }] },
    { id: "high", label: "Больше 40%", effects: [{ item: "2.1", state: "present" }] },
    unk("2.1"),
  ], { autofill: "document" }),
  q("track", "D1", "Есть ли у застройщика сданные проекты?", [
    { id: "yes", label: "Да, один или больше", effects: [{ item: "1.1", state: "absent" }] },
    { id: "no", label: "Нет, это первый проект", effects: [{ item: "1.1", state: "present" }] },
    unk("1.1"),
  ], { autofill: "registry" }),
  q("audit", "D1", "Есть ли аудированная финансовая отчётность застройщика?", [
    { id: "yes", label: "Да, за последний год", effects: [{ item: "1.3", state: "absent" }] },
    { id: "no", label: "Нет", effects: [{ item: "1.3", state: "present" }] },
    unk("1.3"),
  ]),
  q("loan", "D2", "Что известно о строительном кредите?", [
    { id: "drawn", label: "Банк подтвердил письмом", effects: [{ item: "2.2", state: "absent" }, { item: "2.3", state: "absent" }, { item: "1.6", state: "absent" }] },
    { id: "named", label: "Банк назван, подтверждения нет", effects: [{ item: "2.2", state: "present" }, { item: "1.6", state: "absent" }] },
    { id: "none", label: "Кредита нет", effects: [{ item: "1.6", state: "present" }] },
    unk("2.2", "2.3", "1.6"),
  ]),
  q("progress", "D4", "Есть ли подтверждённое движение на стройке за последние 90 дней?", [
    { id: "yes", label: "Да (датированные фото, отчёт инженера)", effects: [{ item: "4.1", state: "absent" }, { item: "4.8", state: "absent" }], gates: { G9: "clear" } },
    { id: "halt", label: "Нет, стройка стоит 90 дней и больше", effects: [{ item: "4.1", state: "present" }], facts: { d4Halt90: true }, gates: { G9: "clear" } },
    { id: "notstarted", label: "Ещё не началась", effects: [{ item: "4.1", state: "absent" }, { item: "4.8", state: "partial" }], gates: { G9: "clear" } },
    unk("4.1", "4.8"),
  ], { autofill: "gis" }),
  q("penalty", "D5", "Есть ли в договоре неустойка застройщика за просрочку сдачи?", [
    { id: "yes", label: "Да", effects: [{ item: "2.5", state: "absent" }] },
    { id: "no", label: "Нет", effects: [{ item: "2.5", state: "present" }] },
    unk("2.5"),
  ], { autofill: "document" }),
  q("cancellation", "D5", "Есть ли право расторгнуть договор и вернуть платежи при задержке сдачи больше 6 месяцев?", [
    { id: "yes", label: "Да, прямо предусмотрено договором", effects: [{ item: "5.3", state: "absent" }] },
    { id: "no", label: "Нет", effects: [{ item: "5.3", state: "present" }] },
    unk("5.3"),
  ], { autofill: "document" }),
  q("rental", "D6", "Как проект предлагает получать доход от аренды?", [
    { id: "none", label: "Аренда не обещается", effects: [] },
    { id: "ltr", label: "Долгосрочная аренда (30 дней и больше)", effects: [{ item: "6.5", state: "unknown" }, { item: "6.6", state: "unknown" }] },
    { id: "str_lic", label: "Посуточная аренда, у проекта есть отельная лицензия", effects: [{ item: "6.4", state: "absent" }], gates: { G10: "clear" } },
    { id: "str_nolic", label: "Посуточная аренда без отельной лицензии", effects: [{ item: "6.4", state: "present" }], gates: { G10: "triggered" } },
  ]),
];

/** The recommended next version: Atlas v2.1 plus the corrections adopted by the owner (stretched scale, weight floor, etc.). */
export const CLEARVIEW_V22: CvConfig = {
  ...ATLAS_V21,
  version: "2.2.0",
  title: "ClearView 2.2: Atlas v2.1 с поправками калибровки",
  calibration: "stretched",
  tierCaps: [
    { domain: "D3", below: 60, max: "BRONZE" }, { domain: "D1", below: 50, max: "BRONZE" }, { domain: "D2", below: 50, max: "BRONZE" },
    { domain: "D3", below: 40, max: "CAUTION" }, { domain: "D4", below: 30, max: "CAUTION" },
    { domain: "D2", below: 30, max: "CAUTION" }, { domain: "D1", below: 30, max: "CAUTION" },
  ],
  weightFloorShare: 0.25,
  quick: QUICK_QUESTIONS,
};

// ── validation ───────────────────────────────────────────────────────────────────────────────────
export function validateConfig(c: CvConfig): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sum = c.domains.reduce((s, d) => s + d.base, 0);
  if (Math.abs(sum - 1) > 1e-6) errors.push(`Базовые веса доменов должны давать 100% (сейчас ${(sum * 100).toFixed(1)}%).`);
  for (const d of c.domains) if (d.base <= 0 || d.base > 0.5) errors.push(`Вес домена ${d.code} вне допустимого диапазона (0–50%).`);
  const codes = new Set<string>();
  for (const it of c.items) {
    if (codes.has(it.code)) errors.push(`Повторяется код пункта ${it.code}.`);
    codes.add(it.code);
    for (const k of ["P", "S", "O"] as const) if (!Number.isInteger(it[k]) || it[k] < 1 || it[k] > 5) errors.push(`Пункт ${it.code}: ${k} должен быть целым от 1 до 5.`);
    if (!(it.weight > 0 && it.weight <= 3)) errors.push(`Пункт ${it.code}: вес вне диапазона (0–3].`);
    if (!c.domains.some((d) => d.code === it.domain)) errors.push(`Пункт ${it.code}: неизвестный домен ${it.domain}.`);
  }
  for (const d of c.domains) if (!c.items.some((i) => i.domain === d.code)) errors.push(`В домене ${d.code} нет ни одного пункта.`);
  for (const g of Object.keys(c.gates) as Gate[]) {
    const n = c.items.filter((i) => i.gate === g).length;
    if (n !== 1) errors.push(`Стоп-условие ${g} должно питаться ровно одним пунктом (сейчас ${n}).`);
  }
  const t = c.tiers;
  if (!(t.PLATINUM > t.GOLD && t.GOLD > t.SILVER && t.SILVER > t.BRONZE && t.BRONZE > t.CAUTION && t.CAUTION > 0 && t.PLATINUM <= 100)) errors.push("Пороги уровней должны убывать от Платины к «Повышенному риску».");
  for (const r of c.tierCaps) if (!(r.below > 0 && r.below <= 100) || !c.domains.some((d) => d.code === r.domain)) errors.push(`Ограничение по слабому домену ${r.domain}: порог должен быть в диапазоне 1–100.`);
  if (c.weightFloorShare !== -1 && (c.weightFloorShare < 0 || c.weightFloorShare > 0.9)) errors.push("Нижняя граница веса: от 0 до 90% базового (или -1: без границы).");
  if (c.weightFloorShare === -1) warnings.push("Нет нижней границы веса: сложение поправок может дать отрицательный вес.");
  for (const [k, v] of Object.entries(c.evidenceC)) if (v < 0.5 || v > 2) errors.push(`Коэффициент доказательств «${k}» вне диапазона 0,5–2.`);
  if (c.evidenceC.registry >= c.evidenceC.developer) warnings.push("Подтверждение реестром должно давать меньший коэффициент риска, чем слова застройщика.");
  if (c.evidenceC.broker < c.evidenceC.developer) warnings.push("Слова брокера не должны быть надёжнее слов застройщика.");
  if (c.items.length !== 57) warnings.push(`В реестре ${c.items.length} пунктов; в Atlas заявлено 57.`);
  return { ok: errors.length === 0, errors, warnings };
}

// ── hashing (publish the fingerprint, keep the content) ──────────────────────────────────────────
export function canonicalJson(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonicalJson).join(",")}]`;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(x);
}

/** Structural check for JSON coming from the database or the studio (never trust the shape). */
export function isCvConfig(x: unknown): x is CvConfig {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<CvConfig>;
  return c.schema === 1 && typeof c.version === "string" && Array.isArray(c.domains) && Array.isArray(c.items) && !!c.gates && !!c.stageMod && !!c.kindMod && !!c.buyerMod
    && !!c.tiers && Array.isArray(c.tierCaps) && !!c.evidenceC && !!c.absentP && !!c.mitigationM && Array.isArray(c.quick);
}

/** Next free patch number for a version list, e.g. 2.2.0 -> 2.2.1. */
export function nextVersion(existing: string[]): string {
  const parsed = existing.map((v) => v.split(".").map(Number)).filter((p) => p.length === 3 && p.every(Number.isFinite));
  if (!parsed.length) return "2.2.0";
  const [a, b, c] = parsed.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).at(-1)!;
  return `${a}.${b}.${c + 1}`;
}
