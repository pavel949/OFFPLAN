import { getPublicSales } from "./sales-public-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { catalogProjectSchema } from "./schema";
import { completeness, type CompletenessItem } from "./studio";

export type PartnerProject = {
  id: string;
  name: string;
  zone: string;
  status: string;
  published: boolean;
  units: number;
  photos: number;
  photosPending: number;
  links: number;
  news: number;
  expiredPrices: boolean;
  score: number;
  next: CompletenessItem | null;
};

export const STATUS_RU: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "warn" },
  pending_review: { label: "На проверке у IE", cls: "warn" },
  published: { label: "Опубликован", cls: "ok" },
  rejected: { label: "Нужны правки", cls: "bad" },
};

const tally = (rows: { project_id: string }[] | null | undefined) => {
  const m = new Map<string, number>();
  for (const r of rows ?? []) m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1);
  return m;
};

/** Developer's own projects with a completeness score; relies on RLS owner-read policies. */
export async function listOrgProjects(db: SupabaseClient, orgId: string): Promise<PartnerProject[]> {
  const { data: rows } = await db
    .from("catalog_projects")
    .select("id, moderation_status, is_published, payload, draft_payload, region_id, developer_id")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });
  const ids = (rows ?? []).map((r) => r.id as string);
  if (!ids.length) return [];
  const [u, ph, pp, so, up] = await Promise.all([
    db.from("project_units").select("project_id, status, price_updated_at").in("project_id", ids),
    db.from("project_evidence").select("project_id").eq("kind", "photo").eq("status", "published").in("project_id", ids),
    db.from("project_evidence").select("project_id").eq("kind", "photo").eq("status", "pending").in("project_id", ids),
    db.from("project_sources").select("project_id").in("project_id", ids),
    db.from("project_updates").select("project_id").in("project_id", ids),
  ]);
  const cu = tally(u.data as { project_id: string }[]), cp = tally(ph.data), cpp = tally(pp.data), cs = tally(so.data), cn = tally(up.data);
  // Use exactly the buyer-facing published revision; legacy unit timestamps do not confirm offers.
  const published = new Map(await Promise.all(ids.map(async id => {
    try { return [id, await getPublicSales(id)] as const; }
    catch { return [id, null] as const; }
  })));
  return (rows ?? []).map((r) => {
    const parsed = catalogProjectSchema.safeParse(r.draft_payload ?? r.payload);
    const p = parsed.success ? parsed.data : null;
    const c = completeness({
      hasDeveloper: !!r.developer_id || !!p?.dev,
      hasLocation: !!p?.zone,
      descLength: p?.desc.length ?? 0,
      hasSource: !!p?.src,
      priceKnown: (published.get(r.id)?.offers.length ?? 0) > 0,
      units: cu.get(r.id) ?? 0,
      photos: cp.get(r.id) ?? 0,
      links: cs.get(r.id) ?? 0,
      news: cn.get(r.id) ?? 0,
    });
    return {
      id: r.id,
      name: p?.n ?? "Без названия",
      zone: p?.zone ?? "",
      status: r.moderation_status as string,
      published: !!r.is_published,
      units: cu.get(r.id) ?? 0,
      photos: cp.get(r.id) ?? 0,
      photosPending: cpp.get(r.id) ?? 0,
      links: cs.get(r.id) ?? 0,
      news: cn.get(r.id) ?? 0,
      expiredPrices: !(published.get(r.id)?.offers.length),
      score: c.score,
      next: c.items.find((i) => !i.done) ?? null,
    };
  });
}
