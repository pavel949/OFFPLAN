"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export async function subscribeToProjectByLegacyId(
  legacyId: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "no supabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sign in required" };

  if (!hasSupabaseServiceConfig()) return { ok: false, error: "server config" };
  const admin = createServiceRoleClient();
  const { data: row } = await admin
    .from("catalog_projects")
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  const projectId = row?.id as string | undefined;
  if (!projectId) return { ok: false, error: "project not found" };

  const { error } = await supabase.from("project_subscriptions").upsert(
    { user_id: user.id, project_id: projectId, channel: "email" },
    { onConflict: "user_id,project_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function unsubscribeFromProjectByLegacyId(
  legacyId: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "no supabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "sign in required" };

  if (!hasSupabaseServiceConfig()) return { ok: false, error: "server config" };
  const admin = createServiceRoleClient();
  const { data: row } = await admin
    .from("catalog_projects")
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  const projectId = row?.id as string | undefined;
  if (!projectId) return { ok: false, error: "project not found" };

  const { error } = await supabase
    .from("project_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}
