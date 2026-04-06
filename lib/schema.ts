import { z } from "zod";

export const recSchema = z.enum(["BUY", "WATCH", "AVOID"]);

/** Full legacy catalogue row — matches `data/seed/projects.json` export. */
export const catalogProjectSchema = z.object({
  id: z.number(),
  n: z.string(),
  dev: z.string(),
  dt: z.string(),
  zone: z.string(),
  seg: z.string(),
  type: z.string(),
  pT: z.string(),
  pN: z.number(),
  pU: z.string(),
  sqmP: z.string(),
  units: z.string(),
  unitSzM2: z.string(),
  minBR: z.number(),
  stK: z.string(),
  stT: z.string(),
  compY: z.number(),
  compQ: z.string(),
  beach: z.string(),
  own: z.string(),
  mgmt: z.string(),
  focus: z.string(),
  yield: z.string(),
  yN: z.number(),
  rat: z.number(),
  risk: z.number(),
  desc: z.string(),
  tags: z.array(z.string()),
  bdg: z.array(z.string()),
  rec: recSchema,
  recText: z.string(),
  src: z.string(),
});

export const catalogProjectsSchema = z.array(catalogProjectSchema);
