import { z } from "zod";

const publicSource = z.url().refine(value=>{
  if(!value.startsWith("https://"))return false;
  const url=new URL(value);
  return !url.username&&!url.password&&![...url.searchParams.keys()].some(k=>/^(?:key|api_key|token|access_token|authorization|signature|x-amz-.+)$/i.test(k));
},"Нужна публичная HTTPS-ссылка без ключей и токенов");
const googleSource=(url:string)=>/(^|\.)(google\.[a-z.]+|goo\.gl)$/i.test(new URL(url).hostname);

/** Provenance travels with the coordinate; a naked lat/lng is never a reviewed address. */
export const locationEvidenceSchema = z.object({
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  precision: z.enum(["project", "entrance", "site", "approximate", "sales_office"]),
  sourceUrl: publicSource,
  confirmationUrl: publicSource.optional(),
  reuseBasis: z.enum(["developer_published","independently_confirmed","open_data"]),
  licenseNote: z.string().trim().min(1).max(600),
  observedOn: z.iso.date(),
  sourceTitle: z.string().trim().min(1).max(200),
  note: z.string().max(600),
  reviewStatus: z.literal("reviewed"),
});
export type ProjectLocation = z.infer<typeof locationEvidenceSchema>;

export function reviewedLocation(evidence: unknown, lat: unknown, lng: unknown, today = new Date().toISOString().slice(0, 10)): ProjectLocation | undefined {
  const r = locationEvidenceSchema.safeParse(evidence);
  if (!r.success || typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (r.data.observedOn > today || Math.abs(r.data.lat - lat) > 0.000001 || Math.abs(r.data.lng - lng) > 0.000001) return;
  // Google discovery alone is insufficient provenance for our independently rendered/offline map.
  if(googleSource(r.data.sourceUrl)&&(!r.data.confirmationUrl||googleSource(r.data.confirmationUrl)))return;
  return r.data;
}

export const LOCATION_PRECISION: Record<ProjectLocation["precision"], string> = {
  project: "Точка проекта · не отдельного юнита",
  entrance: "Въезд в проект",
  site: "Территория комплекса · не отдельное здание или юнит",
  approximate: "Приблизительное положение",
  sales_office: "Офис продаж · не расположение проекта",
};
