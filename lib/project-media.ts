import type { ProjectEvidence } from "./project-evidence";

export const MEDIA_KINDS = ["photo", "render", "masterplan", "unit_plan", "type_plan"] as const;
export type MediaKind = typeof MEDIA_KINDS[number];
export function mediaKind(details: Record<string, unknown>): MediaKind | "unknown" {
  if (MEDIA_KINDS.includes(details.media_kind as MediaKind)) return details.media_kind as MediaKind;
  return details.render === true ? "render" : details.render === false ? "photo" : "unknown";
}
export function mediaLabel(details: Record<string, unknown>, lang: "ru" | "en") {
  const labels = {photo:["Фотография","Photograph"],render:["Визуализация","Render"],masterplan:["Генплан","Master plan"],unit_plan:["Планировка лота","Unit floor plan"],type_plan:["Планировка типа","Type floor plan"],unknown:["Тип изображения не указан","Image type not specified"]};
  return labels[mediaKind(details)][lang === "ru" ? 0 : 1];
}
export function publishedProjectMedia(facts: ProjectEvidence[]) {
  return facts.filter(f => f.kind === "photo" && f.status === "published" && typeof f.details.url === "string" && /^https:\/\//.test(f.details.url)).sort((a,b) => {
    const order = (f: ProjectEvidence) => typeof f.details.sort_order === "number" && Number.isFinite(f.details.sort_order) ? f.details.sort_order : 10000;
    return Number(b.details.cover === true) - Number(a.details.cover === true) || order(a)-order(b) || b.observed_at.localeCompare(a.observed_at) || a.id.localeCompare(b.id);
  });
}
export function mediaForUnit(facts: ProjectEvidence[], unitId: string) {
  return publishedProjectMedia(facts).filter(f => f.details.unit_id === unitId && ["photo","render","unit_plan"].includes(mediaKind(f.details)));
}
