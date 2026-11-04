import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { groupBy, type GroupRow } from "./analytics";
import { locationSlug } from "./slug";
import { zoneLabel } from "./taxonomy";
import type { CatalogProject } from "./types";
import { withTimeout } from "./with-timeout";

/**
 * Locations are data, not code: the catalogue stores a location name in each project (`zone`), the
 * `regions` table adds hierarchy (country > region > district) and names. A project entered anywhere in the
 * world gets its own location page as soon as it is published; unknown locations fall back to their raw name.
 */
export type LocationMeta = {
  slug: string;
  zone: string; // value stored in projects
  nameRu: string;
  nameEn: string;
  level: string | null;
  parentSlug: string | null;
  parentNameRu: string | null;
  parentNameEn: string | null;
  jurisdiction: string | null;
};

export { locationSlug };

export async function getRegionMeta(): Promise<Record<string, LocationMeta>> {
  if (!hasSupabasePublicConfig()) return {};
  return withTimeout(
    (async () => {
      try {
        const { data } = await createAnonClient()
          .from("regions")
          .select("id, slug, level, parent_id, jurisdiction_code, name");
        const byId = new Map((data ?? []).map((r) => [r.id as string, r]));
        const out: Record<string, LocationMeta> = {};
        for (const r of data ?? []) {
          const n = (r.name ?? {}) as { ru?: string; en?: string };
          const parent = r.parent_id ? byId.get(r.parent_id as string) : null;
          const pn = (parent?.name ?? {}) as { ru?: string; en?: string };
          out[r.slug as string] = {
            slug: r.slug as string,
            zone: n.en ?? (r.slug as string),
            nameRu: n.ru ?? n.en ?? (r.slug as string),
            nameEn: n.en ?? n.ru ?? (r.slug as string),
            level: (r.level as string | null) ?? null,
            parentSlug: (parent?.slug as string | undefined) ?? null,
            parentNameRu: pn.ru ?? null,
            parentNameEn: pn.en ?? null,
            jurisdiction: (r.jurisdiction_code as string | null) ?? null,
          };
        }
        return out;
      } catch {
        return {};
      }
    })(),
    6000,
    {} as Record<string, LocationMeta>,
  );
}

/** Meta for a zone: DB row if present, otherwise a label from the taxonomy, otherwise the raw name. */
export function metaFor(zone: string, regions: Record<string, LocationMeta>): LocationMeta {
  const slug = locationSlug(zone);
  const r = regions[slug];
  if (r) return r;
  return {
    slug,
    zone,
    nameRu: zoneLabel(zone, "ru"),
    nameEn: zoneLabel(zone, "en"),
    level: null,
    parentSlug: null,
    parentNameRu: null,
    parentNameEn: null,
    jurisdiction: null,
  };
}

export type LocationRow = GroupRow & { meta: LocationMeta };

export function locationRows(projects: CatalogProject[], regions: Record<string, LocationMeta>): LocationRow[] {
  return groupBy(projects, (p) => locationSlug(p.zone), (p) => p.zone).map((g) => ({
    ...g,
    meta: metaFor(g.label, regions),
  }));
}
