import { z } from "zod";
import { catalogProjectSchema } from "./schema";
import { priceLabel } from "./project-wizard";
import {
  BEACH_KEYS,
  FOCUS_KEYS,
  MANAGEMENT_KEYS,
  OWNERSHIP_KEYS,
  PROPERTY_TYPES,
  SEGMENTS,
  STATUS_KEYS,
  taxLabel,
} from "./taxonomy";

export type CatalogPayload = z.infer<typeof catalogProjectSchema>;

const str = (max: number) => z.string().trim().max(max);
const optNum = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().finite().min(min).max(max).optional());

const nullableNumber = (schema: z.ZodType<number, unknown>) => z.preprocess(v => v === "" || v == null ? null : v, schema.nullable());

/** Fields of the operator "Основное" form. Editorial fields (rat/risk/rec/recText) are included: the operator is the editor. */
export const studioFieldsSchema = z.object({
  n: z.string().trim().min(2, "Укажите название проекта").max(200),
  stK: z.enum(STATUS_KEYS),
  seg: z.enum(SEGMENTS),
  type: z.enum(PROPERTY_TYPES),
  compY: nullableNumber(z.coerce.number().int().min(1990, "Год сдачи: 1990–2100").max(2100, "Год сдачи: 1990–2100")),
  compQ: str(60),
  priceFromM: optNum(0, 100_000),
  pU: str(60),
  sqmP: str(80),
  units: str(120),
  unitSzM2: str(80),
  minBR: nullableNumber(z.coerce.number().int().min(0).max(20)),
  beach: z.enum(BEACH_KEYS),
  own: z.enum(OWNERSHIP_KEYS),
  mgmt: z.enum(MANAGEMENT_KEYS),
  focus: z.enum(FOCUS_KEYS),
  yield: str(40),
  desc: str(4000),
  src: str(1000),
  tags: str(600),
  rat: nullableNumber(z.coerce.number().min(0).max(10)),
  risk: nullableNumber(z.coerce.number().int().min(1).max(3)),
  rec: z.enum(["BUY", "WATCH", "AVOID"]),
  recText: str(4000),
});
export type StudioFields = z.infer<typeof studioFieldsSchema>;

/** Average of the numbers in a yield string such as "6-8%" → 7. */
export function parseYieldMid(s: string): number {
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(",", ".")));
  if (!nums.length) return 0;
  const mid = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round(mid * 10) / 10;
}

export function parseTags(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/**
 * Merge form fields into the existing payload. Developer and location come from the linked records and are
 * passed separately. The price label is only regenerated when the numeric price actually changed, so labels
 * such as "POA" / "TBA" survive unrelated edits.
 */
export function mergeStudioFields(
  existing: CatalogPayload,
  f: StudioFields,
  link: { dev: string; dt: string; zone: string },
): CatalogPayload {
  const priceChanged = f.priceFromM != null && f.priceFromM !== existing.pN;
  const next = {
    ...existing,
    n: f.n,
    dev: link.dev,
    dt: link.dt,
    zone: link.zone,
    seg: f.seg,
    type: f.type,
    stK: f.stK,
    stT: f.stK === existing.stK ? existing.stT : taxLabel("stK", f.stK, "ru"),
    compY: f.compY,
    compQ: f.compQ || (f.compY == null ? "" : String(f.compY)),
    pN: f.priceFromM != null ? f.priceFromM : existing.pN,
    pT: priceChanged ? priceLabel(f.priceFromM as number) : existing.pT,
    pU: f.pU,
    sqmP: f.sqmP || "н/д",
    units: f.units,
    unitSzM2: f.unitSzM2,
    minBR: f.minBR,
    beach: f.beach,
    own: f.own,
    mgmt: f.mgmt,
    focus: f.focus,
    yield: f.yield || "н/д",
    yN: f.yield === existing.yield ? existing.yN : parseYieldMid(f.yield),
    desc: f.desc,
    src: f.src,
    tags: parseTags(f.tags),
    rat: f.rat,
    risk: f.risk,
    rec: f.rec,
    recText: f.recText,
  };
  return catalogProjectSchema.parse(next);
}

export function parseStudioForm(
  fd: FormData,
): { ok: true; fields: StudioFields } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const k of Object.keys(studioFieldsSchema.shape)) raw[k] = fd.get(k) ?? "";
  const r = studioFieldsSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: i?.message ?? "Проверьте поля формы" };
  }
  return { ok: true, fields: r.data };
}

export type CompletenessInput = {
  hasDeveloper: boolean;
  hasLocation: boolean;
  descLength: number;
  hasSource: boolean;
  priceKnown: boolean;
  units: number;
  photos: number;
  links: number;
  news: number;
};

export type CompletenessItem = { key: string; label: string; done: boolean; tab: string; hint: string };

/** Ordered checklist: what a project needs before it can be shown as a full, trustworthy card. */
export function completeness(i: CompletenessInput): { score: number; items: CompletenessItem[] } {
  const items: CompletenessItem[] = [
    { key: "dev", label: "Застройщик привязан", done: i.hasDeveloper, tab: "info", hint: "Выберите застройщика в «Основное»" },
    { key: "loc", label: "Локация привязана", done: i.hasLocation, tab: "info", hint: "Выберите район в «Основное»" },
    { key: "desc", label: "Описание проекта", done: i.descLength >= 80, tab: "info", hint: "Не короче 80 символов" },
    { key: "price", label: "Цена «от»", done: i.priceKnown, tab: "info", hint: "Укажите минимальную цену, млн ฿" },
    { key: "units", label: "Лоты и цены", done: i.units > 0, tab: "units", hint: "Добавьте лоты или вставьте таблицу" },
    { key: "photos", label: "Фото", done: i.photos > 0, tab: "photos", hint: "Загрузите хотя бы одно фото" },
    { key: "links", label: "Материалы и ссылки", done: i.links > 0 || i.hasSource, tab: "materials", hint: "Сайт проекта, прайс, брошюра" },
    { key: "news", label: "Новость о стройке", done: i.news > 0, tab: "news", hint: "Одна запись о ходе работ" },
  ];
  const done = items.filter((x) => x.done).length;
  return { score: Math.round((done / items.length) * 100), items };
}
