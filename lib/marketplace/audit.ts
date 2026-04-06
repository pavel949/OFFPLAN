import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export async function insertCatalogAuditLog(input: {
  entity_type: "project" | "unit" | "campaign" | "update";
  entity_id: string;
  actor_id: string | null;
  action: string;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  if (!hasSupabaseServiceConfig()) return;
  const supabase = createServiceRoleClient();
  await supabase.from("catalog_audit_log").insert({
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    actor_id: input.actor_id,
    action: input.action,
    diff: input.diff ?? null,
  });
}
