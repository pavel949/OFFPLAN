"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

export async function submitCorrectionRequest(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabaseServiceConfig()) {
    return { ok: false, error: "База не настроена (SUPABASE_SERVICE_ROLE_KEY)" };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Настройте NEXT_PUBLIC_SUPABASE_URL и ANON KEY" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Войдите в кабинет застройщика" };
  }
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id) {
    return {
      ok: false,
      error: "Организация не привязана к профилю — обратитесь в IE",
    };
  }
  if (
    prof.role !== "partner" &&
    prof.role !== "admin" &&
    prof.role !== "editor"
  ) {
    return { ok: false, error: "Недостаточно прав" };
  }
  const projectId = String(formData.get("project_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!projectId || !message) {
    return { ok: false, error: "Укажите проект и текст запроса" };
  }
  const admin = createServiceRoleClient();
  const { error } = await admin.from("correction_requests").insert({
    project_id: projectId,
    org_id: prof.org_id,
    message,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
