import { slugify } from "./slug";
import type { CatalogProject } from "./types";

/** Public dossier URL key: the short developer code used by the catalogue (`dt`), slugified. */
export const developerSlug = (dt: string) => slugify(dt);

export type DeveloperSummary = {
  slug: string;
  code: string;
  name: string;
  projects: CatalogProject[];
  zones: string[];
  fromPriceM: number | null;
  completed: number;
  inProgress: number;
};

export function summarizeDevelopers(projects: CatalogProject[]): DeveloperSummary[] {
  const by = new Map<string, DeveloperSummary>();
  for (const p of projects) {
    const slug = developerSlug(p.dt);
    let d = by.get(slug);
    if (!d) {
      d = { slug, code: p.dt, name: p.dev, projects: [], zones: [], fromPriceM: null, completed: 0, inProgress: 0 };
      by.set(slug, d);
    }
    d.projects.push(p);
    if (!d.zones.includes(p.zone)) d.zones.push(p.zone);
    if (p.pN > 0 && (d.fromPriceM == null || p.pN < d.fromPriceM)) d.fromPriceM = p.pN;
    if (p.stK === "ready") d.completed += 1;
    else d.inProgress += 1;
  }
  return [...by.values()].sort((a, b) => b.projects.length - a.projects.length || a.name.localeCompare(b.name));
}
