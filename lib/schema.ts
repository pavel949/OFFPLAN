import { z } from "zod";
import {
  BEACH_KEYS,
  FOCUS_KEYS,
  MANAGEMENT_KEYS,
  OWNERSHIP_KEYS,
  PROPERTY_TYPES,
  RATING_MAX,
  RATING_MIN,
  REC_LABELS,
  RISK_MAX,
  RISK_MIN,
  SEGMENTS,
  STATUS_KEYS,
  ZONES,
} from "./taxonomy";

export const recSchema = z.enum(REC_LABELS);

/**
 * Strict catalogue row. Used on every WRITE path (partner drafts, admin edits,
 * moderation, import): taxonomies are enums, numbers are range-checked.
 * Matches `data/seed/projects.json`.
 */
export const catalogProjectSchema = z.object({
  id: z.number().int().positive(),
  n: z.string().trim().min(1).max(200),
  dev: z.string().trim().min(1).max(200),
  /** Short developer code used by the developer filter. */
  dt: z.string().trim().min(1).max(60),
  zone: z.enum(ZONES),
  seg: z.enum(SEGMENTS),
  type: z.enum(PROPERTY_TYPES),
  pT: z.string().max(60),
  pN: z.number().min(0).max(100_000),
  pU: z.string().max(60),
  sqmP: z.string().max(80),
  units: z.string().max(120),
  unitSzM2: z.string().max(80),
  minBR: z.number().int().min(0).max(20),
  stK: z.enum(STATUS_KEYS),
  stT: z.string().max(200),
  compY: z.number().int().min(1990).max(2100),
  compQ: z.string().max(60),
  beach: z.enum(BEACH_KEYS),
  own: z.enum(OWNERSHIP_KEYS),
  mgmt: z.enum(MANAGEMENT_KEYS),
  focus: z.enum(FOCUS_KEYS),
  yield: z.string().max(40),
  yN: z.number().min(0).max(50),
  rat: z.number().min(RATING_MIN).max(RATING_MAX),
  risk: z.number().int().min(RISK_MIN).max(RISK_MAX),
  desc: z.string().max(4000),
  tags: z.array(z.string().max(80)).max(12),
  bdg: z.array(z.string().max(40)).max(12),
  rec: recSchema,
  recText: z.string().max(4000),
  src: z.string().max(1000),
});

export const catalogProjectsSchema = z.array(catalogProjectSchema);

/**
 * Lenient READ: validate row by row so that one bad row never hides the whole
 * catalogue. Invalid rows are reported through `onInvalid` and skipped.
 */
export function parseCatalogRows(
  rows: unknown[],
  onInvalid?: (index: number, error: z.ZodError) => void,
): z.infer<typeof catalogProjectSchema>[] {
  const out: z.infer<typeof catalogProjectSchema>[] = [];
  rows.forEach((row, i) => {
    const r = catalogProjectSchema.safeParse(row);
    if (r.success) out.push(r.data);
    else onInvalid?.(i, r.error);
  });
  return out;
}
