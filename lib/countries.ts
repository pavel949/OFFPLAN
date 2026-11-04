import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { LEGAL_TOPICS, type LegalStatus, type LegalTopic } from "./country-content";
import { GEO, type GeoCountry } from "./geo-seed";
import { getRegionMeta, type LocationMeta } from "./locations";
import { withTimeout } from "./with-timeout";

export type CountryRegion = {
  slug: string;
  ru: string;
  en: string;
  locations: { slug: string; ru: string; en: string }[];
};
export type CountryTree = Omit<GeoCountry, "regions"> & { regions: CountryRegion[] };

/** Countries with their regions and locations, built from the `regions` table (fallback: geo seed). */
export async function getCountryTrees(): Promise<CountryTree[]> {
  const meta = await getRegionMeta();
  const byParent = new Map<string, LocationMeta[]>();
  for (const m of Object.values(meta)) if (m.parentSlug) (byParent.get(m.parentSlug) ?? byParent.set(m.parentSlug, []).get(m.parentSlug)!).push(m);
  return GEO.map((c) => ({
    ...c,
    regions: c.regions.map((r) => ({
      slug: r.slug,
      ru: r.ru,
      en: r.en,
      // locations known to the database win over the seed (new districts added in the admin appear automatically)
      locations: (() => {
        const db = byParent.get(r.slug);
        return db?.length
          ? db.map((m) => ({ slug: m.slug, ru: m.nameRu, en: m.nameEn }))
          : r.locations.map((l) => ({ slug: l.slug, ru: l.ru, en: l.en }));
      })(),
    })),
  }));
}

export function countryOfLocation(slug: string, trees: CountryTree[]): CountryTree | null {
  return trees.find((c) => c.regions.some((r) => r.slug === slug || r.locations.some((l) => l.slug === slug))) ?? null;
}

export async function getLegalTopics(code: string): Promise<LegalTopic[]> {
  const fallback = LEGAL_TOPICS.filter((t) => t.country === code).sort((a, b) => a.sort - b.sort);
  if (!hasSupabasePublicConfig()) return fallback;
  return withTimeout(
    (async (): Promise<LegalTopic[]> => {
      try {
        const { data, error } = await createAnonClient()
          .from("legal_topics")
          .select("jurisdiction_code, topic, title_ru, summary_ru, points_ru, sources, status, reviewed_by, reviewed_at, valid_until, sort_order")
          .eq("jurisdiction_code", code)
          .order("sort_order");
        if (error || !data?.length) return fallback;
        return data.map((r) => ({
          country: r.jurisdiction_code as LegalTopic["country"],
          topic: r.topic as string,
          title: r.title_ru as string,
          summary: r.summary_ru as string,
          points: (r.points_ru as string[]) ?? [],
          status: r.status as LegalStatus,
          reviewedBy: (r.reviewed_by as string | null) ?? null,
          reviewedAt: (r.reviewed_at as string | null) ?? null,
          validUntil: (r.valid_until as string | null) ?? null,
          sources: (r.sources as { title: string; url: string }[]) ?? [],
          sort: (r.sort_order as number) ?? 100,
        }));
      } catch {
        return fallback;
      }
    })(),
    6000,
    fallback,
  );
}

/** A verified topic whose validity date has passed counts as outdated. */
export function effectiveStatus(t: LegalTopic, now = new Date()): LegalStatus {
  if (t.status === "verified" && t.validUntil && new Date(t.validUntil).getTime() < now.getTime()) return "outdated";
  return t.status;
}
