/**
 * Canonical taxonomies for the catalogue. Single source of truth for validation,
 * filters and admin/partner forms. Keep in sync with data/seed/projects.json
 * (enforced by lib/schema.test.ts).
 */

export const REC_LABELS = ["BUY", "WATCH", "AVOID"] as const;

export const SEGMENTS = [
  "unknown",
  "offplan-new",
  "condo",
  "villa-entry",
  "villa-mid",
  "villa-lux",
  "branded",
  "completed",
] as const;

export const PROPERTY_TYPES = ["unknown", "condo", "villa", "house"] as const;

/** Construction status key. */
export const STATUS_KEYS = ["unknown", "offplan", "building", "ready"] as const;

/** Distance to beach: beachfront, ≤500m, ≤1km, inland. */
export const BEACH_KEYS = ["unknown", "bf", "500", "1k", "inl"] as const;

/** Ownership: freehold, leasehold, both. */
export const OWNERSHIP_KEYS = ["unknown", "fh", "lh", "both"] as const;

export const MANAGEMENT_KEYS = ["unknown", "pro", "hotel", "self"] as const;

export const FOCUS_KEYS = ["unknown", "STR", "LTR", "lifestyle", "growth", "mixed"] as const;

/** Risk tier: 1 low · 2 medium · 3 high (matches Risk tab and platform_settings). */
export const RISK_MIN = 1;
export const RISK_MAX = 3;

/** Composite rating scale. */
export const RATING_MIN = 0;
export const RATING_MAX = 10;

export const ZONES = [
  "Bang Tao",
  "Cape Panwa",
  "Cape Yamu",
  "Chalong",
  "Cherngtalay",
  "Kamala",
  "Karon",
  "Kata",
  "Kathu",
  "Koh Kaew",
  "Laguna",
  "Layan",
  "Mai Khao",
  "NW Coast",
  "Nai Harn",
  "Nai Yang",
  "Natai",
  "Patong",
  "Phuket Town",
  "Rawai",
  "Si Sunthon",
  "Surin",
  "Thalang",
] as const;

export type Zone = (typeof ZONES)[number];

// ---------------------------------------------------------------------------
// Display labels (single source for UI, filters, admin/partner forms and DB seeds).
// `short` variants are for tight spaces (cards, chips). Russian is the editorial reference.
// ---------------------------------------------------------------------------
export type TaxonomyKind =
  | "seg"
  | "type"
  | "stK"
  | "beach"
  | "own"
  | "mgmt"
  | "focus"
  | "risk"
  | "rec";

export interface TermLabel {
  ru: string;
  en: string;
  ruShort?: string;
  enShort?: string;
}

export const TAXONOMY_LABELS: Record<TaxonomyKind, Record<string, TermLabel>> = {
  seg: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    "offplan-new": { ru: "Новые проекты (оффплан)", en: "New off-plan", ruShort: "Новый оффплан" },
    condo: { ru: "Инвестиционные кондо", en: "Investment condo", ruShort: "Инвест-кондо" },
    "villa-entry": { ru: "Виллы: входной сегмент", en: "Villa — entry", ruShort: "Виллы: вход" },
    "villa-mid": { ru: "Виллы: премиум-класс", en: "Villa — premium", ruShort: "Виллы: премиум" },
    "villa-lux": { ru: "Виллы: люкс", en: "Villa — luxury", ruShort: "Виллы: люкс" },
    branded: { ru: "Брендированные резиденции и ультра-люкс", en: "Ultra-luxury & branded", ruShort: "Бренд / ультра-люкс" },
    completed: { ru: "Сданные в 2024–2025 гг.", en: "Completed 2024–25", ruShort: "Сданные 2024–25" },
  },
  type: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    condo: { ru: "Кондоминиум", en: "Condominium" },
    villa: { ru: "Вилла", en: "Villa" },
    house: { ru: "Дом / таунхаус", en: "House / townhouse" },
  },
  stK: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    offplan: { ru: "Оффплан (старт продаж)", en: "Off-plan (pre-launch)", ruShort: "Оффплан" },
    building: { ru: "Строится", en: "Under construction" },
    ready: { ru: "Сдан", en: "Completed" },
  },
  beach: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    bf: { ru: "Первая линия", en: "Beachfront" },
    "500": { ru: "До 500 м от пляжа", en: "Within 500 m", ruShort: "До 500 м" },
    "1k": { ru: "До 1 км от пляжа", en: "Within 1 km", ruShort: "До 1 км" },
    inl: { ru: "Вдали от пляжа", en: "Inland", ruShort: "Вдали от моря" },
  },
  own: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    fh: { ru: "Фрихолд (полная собственность)", en: "Freehold", ruShort: "Фрихолд" },
    lh: { ru: "Лизхолд (долгосрочная аренда)", en: "Leasehold", ruShort: "Лизхолд" },
    both: { ru: "Фрихолд и лизхолд", en: "Freehold & leasehold", ruShort: "Фрихолд / лизхолд" },
  },
  mgmt: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    pro: { ru: "Профессиональная управляющая компания", en: "Professional management", ruShort: "Управляющая компания" },
    hotel: { ru: "Под гостиничным брендом", en: "Hotel-brand managed", ruShort: "Гостиничный бренд" },
    self: { ru: "Самостоятельное управление", en: "Self-managed", ruShort: "Самоуправление" },
  },
  focus: {
    unknown: { ru: "Не подтверждено", en: "Not confirmed" },
    STR: { ru: "Краткосрочная аренда (STR)", en: "Short-term rental (STR)", ruShort: "Краткосрочная аренда", enShort: "STR" },
    LTR: { ru: "Долгосрочная аренда (LTR)", en: "Long-term rental (LTR)", ruShort: "Долгосрочная аренда", enShort: "LTR" },
    lifestyle: { ru: "Для проживания (лайфстайл)", en: "Lifestyle", ruShort: "Для проживания" },
    growth: { ru: "Рост капитала", en: "Capital growth" },
    mixed: { ru: "Смешанная стратегия", en: "Mixed" },
  },
  risk: {
    "1": { ru: "Уровень 1 — низкий риск", en: "Tier 1 — low risk", ruShort: "Уровень 1 · низкий", enShort: "Tier 1 · Low" },
    "2": { ru: "Уровень 2 — средний риск", en: "Tier 2 — medium risk", ruShort: "Уровень 2 · средний", enShort: "Tier 2 · Medium" },
    "3": { ru: "Уровень 3 — повышенный риск", en: "Tier 3 — elevated risk", ruShort: "Уровень 3 · повышенный", enShort: "Tier 3 · Higher" },
  },
  rec: {
    BUY: { ru: "Рекомендуется к покупке", en: "Buy", ruShort: "К покупке", enShort: "Buy" },
    WATCH: { ru: "Наблюдать", en: "Watch", ruShort: "Наблюдать", enShort: "Watch" },
    AVOID: { ru: "Не рекомендуется", en: "Avoid", ruShort: "Не рекомендуется", enShort: "Avoid" },
  },
};

/** Russian names of districts. Keys are the canonical `ZONES` values stored in the data. */
export const ZONE_LABELS: Record<Zone, { ru: string; en: string }> = {
  "Bang Tao": { ru: "Банг-Тао", en: "Bang Tao" },
  "Cape Panwa": { ru: "Мыс Панва", en: "Cape Panwa" },
  "Cape Yamu": { ru: "Мыс Яму", en: "Cape Yamu" },
  Chalong: { ru: "Чалонг", en: "Chalong" },
  Cherngtalay: { ru: "Чернгталай", en: "Cherngtalay" },
  Kamala: { ru: "Камала", en: "Kamala" },
  Karon: { ru: "Карон", en: "Karon" },
  Kata: { ru: "Ката", en: "Kata" },
  Kathu: { ru: "Кату", en: "Kathu" },
  "Koh Kaew": { ru: "Ко-Кэо", en: "Koh Kaew" },
  Laguna: { ru: "Лагуна", en: "Laguna" },
  Layan: { ru: "Лаян", en: "Layan" },
  "Mai Khao": { ru: "Май-Кхао", en: "Mai Khao" },
  "NW Coast": { ru: "Северо-западное побережье", en: "NW Coast" },
  "Nai Harn": { ru: "Най-Харн", en: "Nai Harn" },
  "Nai Yang": { ru: "Най-Янг", en: "Nai Yang" },
  Natai: { ru: "Натай", en: "Natai" },
  Patong: { ru: "Патонг", en: "Patong" },
  "Phuket Town": { ru: "Пхукет-Таун", en: "Phuket Town" },
  Rawai: { ru: "Равай", en: "Rawai" },
  "Si Sunthon": { ru: "Си-Сунтхон", en: "Si Sunthon" },
  Surin: { ru: "Сурин", en: "Surin" },
  Thalang: { ru: "Тхаланг", en: "Thalang" },
};

export function taxLabel(
  kind: TaxonomyKind,
  key: string | number,
  lang: "ru" | "en",
  short = false,
): string {
  const t = TAXONOMY_LABELS[kind][String(key)];
  if (!t) return String(key);
  if (lang === "ru") return (short && t.ruShort) || t.ru;
  return (short && t.enShort) || t.en;
}

export function zoneLabel(zone: string, lang: "ru" | "en"): string {
  if (zone === "Phuket") return lang === "ru" ? "Пхукет · район уточняется" : "Phuket · district unconfirmed";
  const z = (ZONE_LABELS as Record<string, { ru: string; en: string }>)[zone];
  return z ? z[lang] : zone;
}
