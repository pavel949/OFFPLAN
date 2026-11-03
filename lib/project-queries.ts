import { createAnonClient, hasSupabasePublicConfig } from "@/lib/supabase/anon";
import { withTimeout } from "./with-timeout";

const DB_TIMEOUT_MS = 8000;

export type ProjectUnitRow = {
  id: string;
  label: string;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price_thb: number | null;
  status: string;
  plan_url: string | null;
};

export type SalesCampaignRow = {
  id: string;
  kind: string;
  starts_at: string | null;
  ends_at: string | null;
  label_en: string;
  label_ru: string;
};

export type ProjectUpdateRow = {
  id: string;
  kind: string;
  title_en: string;
  title_ru: string;
  body_en: string;
  body_ru: string;
  published_at: string;
};

export async function getProjectExtrasByLegacyId(legacyId: number): Promise<{
  catalogProjectId: string | null;
  units: ProjectUnitRow[];
  campaigns: SalesCampaignRow[];
  updates: ProjectUpdateRow[];
  lat: number | null;
  lng: number | null;
  dataConfirmedAt: string | null;
}> {
  const empty = {
    catalogProjectId: null,
    units: [] as ProjectUnitRow[],
    campaigns: [] as SalesCampaignRow[],
    updates: [] as ProjectUpdateRow[],
    lat: null,
    lng: null,
    dataConfirmedAt: null,
  };

  if (!hasSupabasePublicConfig()) return empty;

  return withTimeout(
    (async () => {
      const supabase = createAnonClient();
      const { data: cp } = await supabase
        .from("catalog_projects")
        .select("id, lat, lng, data_confirmed_at")
        .eq("legacy_id", legacyId)
        .maybeSingle();
      if (!cp) return empty;

      const pid = cp.id as string;
      const dataConfirmedAt =
        (cp as { data_confirmed_at?: string | null }).data_confirmed_at ?? null;

      const [unitsRes, campRes, updRes] = await Promise.all([
        supabase
          .from("project_units")
          .select(
            "id, label, bedrooms, floor, sqm, price_thb, status, plan_url",
          )
          .eq("project_id", pid)
          .order("sort_order", { ascending: true }),
        supabase
          .from("sales_campaigns")
          .select("id, kind, starts_at, ends_at, label_en, label_ru")
          .eq("project_id", pid),
        supabase
          .from("project_updates")
          .select(
            "id, kind, title_en, title_ru, body_en, body_ru, published_at",
          )
          .eq("project_id", pid)
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(20),
      ]);
      const units = (unitsRes.data ?? []) as ProjectUnitRow[];
      const campaigns = (campRes.data ?? []) as SalesCampaignRow[];
      const updates = (updRes.data ?? []) as ProjectUpdateRow[];
      return {
        catalogProjectId: pid,
        units,
        campaigns,
        updates,
        lat: cp.lat,
        lng: cp.lng,
        dataConfirmedAt,
      };
    })(),
    DB_TIMEOUT_MS,
    empty,
  );
}