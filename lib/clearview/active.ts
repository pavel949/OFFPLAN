import { CLEARVIEW_V22, isCvConfig, type CvConfig } from "./config";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

/** The published rules for Thailand; before the first publication the recommended built-in version is used. Server-only. */
export async function getActiveConfig(): Promise<CvConfig> {
  if (!hasSupabaseServiceConfig()) return CLEARVIEW_V22;
  try {
    const { data } = await createServiceRoleClient().from("cv_methodology_versions").select("config").eq("jurisdiction_code", "TH").eq("status", "published").maybeSingle();
    return data && isCvConfig(data.config) ? data.config : CLEARVIEW_V22;
  } catch {
    return CLEARVIEW_V22;
  }
}
