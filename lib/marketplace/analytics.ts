import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export async function recordAnalyticsEvent(input: {
  name: string;
  project_id?: string | null;
  user_id?: string | null;
  session_id?: string | null;
  path?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (!hasSupabaseServiceConfig()) return;
  const supabase = createServiceRoleClient();
  await supabase.from("analytics_events").insert({
    name: input.name,
    project_id: input.project_id ?? null,
    user_id: input.user_id ?? null,
    session_id: input.session_id ?? null,
    path: input.path ?? null,
    payload: input.payload ?? {},
  });
}
