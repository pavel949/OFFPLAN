import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import type { InventorySummary, ProjectEvidence } from "./project-evidence";
export type PublicProjectFacts = {
  facts: ProjectEvidence[];
  inventory: InventorySummary | null;
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
    developerProjects: [],
    error: false,
  };
  if (!projectId || !hasSupabasePublicConfig()) return empty;
  const db = createAnonClient();
  const [facts, inventory, history] = await Promise.all([
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
  ]);
  return {
    facts: (facts.data ?? []) as ProjectEvidence[],
    inventory: inventory.data as InventorySummary | null,
    developerProjects: (history.data ?? []).filter(
      (x) => x.legacy_id != null,
    ) as PublicProjectFacts["developerProjects"],
    error: !!(facts.error || inventory.error || history.error),
  };
}
