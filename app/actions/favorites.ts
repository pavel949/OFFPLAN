"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

async function resolveProjectUuid(
  legacyId: number,
): Promise<string | null> {
  if (!hasSupabaseServiceConfig()) return null;
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("catalog_projects")
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function toggleFavoriteLegacy(
  legacyId: number,
  add: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "no supabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sign in required" };

  const projectUuid = await resolveProjectUuid(legacyId);
  if (!projectUuid) return { ok: false, error: "project not found" };

  if (add) {
    const { error } = await supabase.from("favorites").upsert(
      { user_id: user.id, project_id: projectUuid },
      { onConflict: "user_id,project_id" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("project_id", projectUuid);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/account");
  return { ok: true };
}
