import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { withTimeout } from "./with-timeout";
import { getPublishedAvailability } from "./published-availability-query";
import type { PublishedAvailability } from "./published-availability";
import type { PublicSource } from "./sources";

/**
 * Public extras shown on the home page and developer dossiers, keyed by the public (legacy) project id:
 * cover photos, latest construction news, live promotions, availability, public material links.
 * Every part fails soft: a missing table or a slow query never blocks the catalogue.
 */
export type HomeFeed = {
  covers: Record<number, { url: string; caption: string; at: string; render?:boolean; mediaType?:string }>;
  updates: {
    id: string;
    projectId: number;
    kind: string;
    titleRu: string;
    titleEn: string;
    bodyRu: string;
    at: string;
  }[];
  campaigns: Record<number, { labelRu: string; endsAt: string | null }>;
  availability: Record<number, PublishedAvailability>;
  sources: Record<number, PublicSource[]>;
};

const EMPTY: HomeFeed = { covers: {}, updates: [], campaigns: {}, availability: {}, sources: {} };

export async function getHomeFeed(): Promise<HomeFeed> {
  if (!hasSupabasePublicConfig()) return EMPTY;
  return withTimeout(
    (async (): Promise<HomeFeed> => {
      try {
        const db = createAnonClient();
        const [ids, photos, upd, camp, inv, src] = await Promise.all([
          db.from("public_catalog_projects").select("id, legacy_id"),
          db
            .from("project_evidence")
            .select("project_id, details, observed_at")
            .eq("kind", "photo")
            .eq("status", "published")
            .order("observed_at", { ascending: false })
            .limit(400),
          db
            .from("project_updates")
            .select("id, project_id, kind, title_ru, title_en, body_ru, published_at")
            .order("published_at", { ascending: false })
            .limit(24),
          db.from("sales_campaigns").select("project_id, label_ru, ends_at, starts_at").limit(200),
          getPublishedAvailability(),
          db.from("public_project_sources").select("id, project_id, kind, title, url, cadence, confirmed_at"),
        ]);
        const legacy = new Map<string, number>();
        for (const r of ids.data ?? [])
          if (r.legacy_id != null) legacy.set(r.id as string, r.legacy_id as number);

        const feed: HomeFeed = { covers: {}, updates: [], campaigns: {}, availability: {}, sources: {} };
        for (const r of photos.data ?? []) {
          const id = legacy.get(r.project_id as string);
          const d = r.details as { url?: string; caption?: string; render?:boolean; cover?:boolean; media_type?:string } | null;
          if (id == null || !d?.url || (feed.covers[id] && !d.cover)) continue;
          feed.covers[id] = { url: d.url, caption: d.caption ?? "", at: r.observed_at as string, render:d.render === true, mediaType:d.media_type };
        }
        for (const r of upd.data ?? []) {
          const id = legacy.get(r.project_id as string);
          if (id == null) continue;
          feed.updates.push({
            id: r.id as string,
            projectId: id,
            kind: r.kind as string,
            titleRu: (r.title_ru as string) || (r.title_en as string) || "",
            titleEn: (r.title_en as string) || (r.title_ru as string) || "",
            bodyRu: (r.body_ru as string) || "",
            at: r.published_at as string,
          });
        }
        const now = Date.now();
        for (const r of camp.data ?? []) {
          const id = legacy.get(r.project_id as string);
          const ends = (r.ends_at as string | null) ?? null;
          const starts = (r.starts_at as string | null) ?? null;
          if (id == null) continue;
          if (ends && new Date(ends).getTime() < now) continue;
          if (starts && new Date(starts).getTime() > now) continue;
          feed.campaigns[id] = { labelRu: (r.label_ru as string) || "", endsAt: ends };
        }
        feed.availability = inv;
        for (const r of src.data ?? []) {
          const id = legacy.get(r.project_id as string);
          if (id == null) continue;
          (feed.sources[id] ??= []).push(r as unknown as PublicSource);
        }
        return feed;
      } catch {
        return EMPTY;
      }
    })(),
    6000,
    EMPTY,
  );
}

export type DeveloperRow = {
  code: string;
  nameRu: string;
  nameEn: string;
  legalName: string | null;
  registrationNo: string | null;
  website: string | null;
};

export async function getDevelopers(): Promise<Record<string, DeveloperRow>> {
  if (!hasSupabasePublicConfig()) return {};
  return withTimeout(
    (async () => {
      try {
        const { data } = await createAnonClient()
          .from("developers")
          .select("code, name_ru, name_en, legal_name, registration_no, website");
        const out: Record<string, DeveloperRow> = {};
        for (const r of data ?? [])
          out[r.code as string] = {
            code: r.code as string,
            nameRu: (r.name_ru as string) || (r.name_en as string) || (r.code as string),
            nameEn: (r.name_en as string) || (r.name_ru as string) || (r.code as string),
            legalName: (r.legal_name as string | null) ?? null,
            registrationNo: (r.registration_no as string | null) ?? null,
            website: (r.website as string | null) ?? null,
          };
        return out;
      } catch {
        return {};
      }
    })(),
    6000,
    {} as Record<string, DeveloperRow>,
  );
}
