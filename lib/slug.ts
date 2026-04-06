/** URL-safe slug for project detail routes. */

export function slugify(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return t || "project";
}

export function projectSlug(project: { id: number; n: string }): string {
  return `${slugify(project.n)}-${project.id}`;
}

/** Parse legacy numeric id from slug suffix `...-123`. */
export function parseLegacyIdFromSlug(slug: string): number | null {
  const m = slug.match(/-(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
