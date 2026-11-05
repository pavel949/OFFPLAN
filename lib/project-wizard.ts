import { z } from "zod";
import { catalogProjectSchema } from "./schema";
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

/**
 * "New project" wizard input. Developers and operators fill plain fields; the catalogue payload is built
 * here. Editorial fields (rating, risk tier, BUY/WATCH/AVOID text) are never taken from the form:
 * they stay at neutral placeholders until the IE team sets them during review.
 */
const optionalNumber = (schema: z.ZodType<number, unknown>) =>
  z.preprocess(value => value == null || (typeof value === "string" && !value.trim()) ? null : value, schema.nullable());

export const wizardSchema = z.object({
  n: z.string().trim().min(2, "Укажите название проекта").max(200),
  dev: z.string().trim().min(1).max(200),
  zone: z.string().trim().min(1, "Укажите локацию").max(80),
  seg: z.enum(SEGMENTS),
  type: z.enum(PROPERTY_TYPES),
  /** Starting price in millions of THB (e.g. 7.5). */
  priceFromM: optionalNumber(z.coerce.number().finite().positive().max(100_000)),
  /** Total number of units in the project. */
  unitsTotal: optionalNumber(z.coerce.number().int().min(1).max(100_000)),
  minBR: optionalNumber(z.coerce.number().int().min(0).max(20)),
  stK: z.enum(STATUS_KEYS),
  compY: optionalNumber(z.coerce.number().int().min(1990).max(2100)),
  compQ: z.string().trim().max(60).default(""),
  beach: z.enum(BEACH_KEYS),
  own: z.enum(OWNERSHIP_KEYS),
  mgmt: z.enum(MANAGEMENT_KEYS),
  focus: z.enum(FOCUS_KEYS),
  desc: z.string().trim().min(20, "Опишите проект (не короче 20 символов)").max(4000),
  /** Link to the developer's own page or material, shown as the data source. */
  src: z
    .string()
    .trim()
    .max(1000)
    .refine((s) => s === "" || /^https:\/\/\S+$/.test(s), "Ссылка должна начинаться с https://"),
});
export type WizardInput = z.infer<typeof wizardSchema>;

export function devCode(dev: string): string {
  const first = dev.replace(/\b(co\.?|ltd\.?|pcl|plc|group|holdings?|company)\b/gi, "").trim().split(/\s+/)[0];
  return (first || dev).slice(0, 60);
}

export function priceLabel(m: number): string {
  const v = String(m);
  return `฿${v}M+`;
}

export function buildPayloadFromWizard(i: WizardInput) {
  const payload = {
    // Placeholder: the public ID is assigned by the database on approval and always overrides this.
    id: 1,
    n: i.n,
    dev: i.dev,
    dt: devCode(i.dev),
    zone: i.zone,
    seg: i.seg,
    type: i.type,
    pT: i.priceFromM == null ? "POA" : priceLabel(i.priceFromM),
    pN: i.priceFromM ?? 0,
    pU: "",
    sqmP: "н/д",
    units: i.unitsTotal == null ? "" : String(i.unitsTotal),
    unitSzM2: "",
    minBR: i.minBR,
    stK: i.stK,
    stT: taxLabel("stK", i.stK, "ru"),
    compY: i.compY,
    compQ: i.compQ || (i.compY == null ? "" : String(i.compY)),
    beach: i.beach,
    own: i.own,
    mgmt: i.mgmt,
    focus: i.focus,
    yield: "н/д",
    yN: 0,
    // Editorial fields stay neutral until IE reviews the project.
    rat: null,
    risk: null,
    desc: i.desc,
    tags: ["Заявлено застройщиком"],
    bdg: [] as string[],
    rec: "WATCH" as const,
    recText: "",
    src: i.src,
  };
  return catalogProjectSchema.parse(payload);
}

export function parseWizardForm(f: FormData):
  | { ok: true; payload: ReturnType<typeof buildPayloadFromWizard> }
  | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const k of Object.keys(wizardSchema.shape)) raw[k] = f.get(k) ?? "";
  if (raw.zone === "__unknown") raw.zone = "Location unconfirmed";
  if (raw.zone === "__other") raw.zone = String(f.get("zoneOther") ?? "").trim();
  const r = wizardSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `${i?.path.join(".") || "поле"}: ${i?.message ?? "ошибка"}` };
  }
  try {
    return { ok: true, payload: buildPayloadFromWizard(r.data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось собрать карточку" };
  }
}

