import { cache } from "react";
import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "./supabase/service";
import { salesModelSchema } from "./sales-model";
import { publishedAvailability, type PublishedAvailability } from "./published-availability";
import { withTimeout } from "./with-timeout";

/** Server read: only counts/dates cross the public boundary, never private models or sources. */
export const getPublishedAvailability = cache(async (): Promise<Record<number, PublishedAvailability>> => {
  if (!hasSupabasePublicConfig() || !hasSupabaseServiceConfig()) return {};
  return withTimeout((async () => {
    try {
      const db = createServiceRoleClient();
      const [projects, publications] = await Promise.all([
        createAnonClient().from("public_catalog_projects").select("id,legacy_id"),
        db.from("project_sales_publications").select("project_id,revision,expires_at").gt("expires_at", new Date().toISOString()),
      ]);
      if (projects.error || publications.error) return {};
      const legacy = new Map((projects.data ?? []).map(p => [p.id as string, p.legacy_id as number]));
      const active = (publications.data ?? []).filter(p => legacy.has(p.project_id));
      const out: Record<number, PublishedAvailability> = {};
      // Bounded batches; include only the exact published revisions, not private drafts.
      for (let start = 0; start < active.length; start += 50) {
        const batch = active.slice(start, start + 50);
        const models = await db.from("project_sales_models").select("project_id,revision,model").or(batch.map(p => `and(project_id.eq.${p.project_id},revision.eq.${p.revision})`).join(","));
        if (models.error) return {};
        const units: { project_id: string; id: string; label: string; status: string }[] = [];
        for (let offset = 0;; offset += 500) {
          const r = await db.from("project_units").select("project_id,id,label,status").in("project_id", batch.map(p => p.project_id)).order("id").range(offset, offset + 499);
          if (r.error) return {};
          units.push(...r.data);
          if (r.data.length < 500) break;
        }
        for (const p of batch) {
          const row = models.data?.find(m => m.project_id === p.project_id && m.revision === p.revision);
          const parsed = salesModelSchema.safeParse(row?.model);
          if (!parsed.success) continue;
          const summary = publishedAvailability(parsed.data, p, units.filter(u => u.project_id === p.project_id));
          if (summary) out[legacy.get(p.project_id)!] = summary;
        }
      }
      return out;
    } catch { return {}; }
  })(), 6000, {});
});
