import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import type { PublicSource } from "./sources";
import type { InventorySummary, ProjectEvidence } from "./project-evidence";
export type PublicProjectFacts = {
  facts: ProjectEvidence[];
  inventory: InventorySummary | null;
  sources: PublicSource[];
  developerProjects: {
    legacy_id: number;
    slug: string;
    payload: { n: string; stK: string };
  }[];
  error: boolean;
};
export async function getPublicProjectFacts(
  projectId: string | null,
  developerId: string | null,
): Promise<PublicProjectFacts> {
  const empty: PublicProjectFacts = {
    facts: [],
    inventory: null,
    sources: [],
    developerProjects: [],
    error: false,
  };
  if (!projectId || !hasSupabasePublicConfig()) return empty;
  const db = createAnonClient();
  const [facts, inventory, history, sources] = await Promise.all([
    db
      .from("project_evidence")
      .select(
        "id,project_id,kind,fact_key,title,source_url,observed_at,details,status,reviewed_at",
      )
      .eq("project_id", projectId)
      .eq("status", "published")
      .order("observed_at", { ascending: false }),
    db
      .from("public_project_inventory")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    developerId
      ? db
          .from("public_catalog_projects")
          .select("legacy_id,slug,payload")
          .eq("developer_id", developerId)
          .neq("id", projectId)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("public_project_sources")
      .select("id,project_id,kind,title,url,cadence,confirmed_at")
      .eq("project_id", projectId)
      .order("kind"),
  ]);
  return {
    facts: (facts.data ?? []) as ProjectEvidence[],
    inventory: inventory.data as InventorySummary | null,
    sources: (sources.data ?? []) as PublicSource[],
    developerProjects: (history.data ?? []).filter(
      (x) => x.legacy_id != null,
    ) as PublicProjectFacts["developerProjects"],
    error: !!(facts.error || inventory.error || history.error),
  };
}
