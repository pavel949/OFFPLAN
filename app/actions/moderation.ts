"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { catalogProjectSchema } from "@/lib/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

async function requireAdmin() {
  if (!(await getAdminSessionOk())) {
    throw new Error("Unauthorized");
  }
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Supabase service role not configured");
  }
  return createServiceRoleClient();
}

export async function saveProjectDraft(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Настройте Supabase (anon key)" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Войдите в кабинет" };

  const { data: profDraft } = await supabase
    .from("profiles")
    .select("role, partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profDraft?.role === "partner" &&
    profDraft.partner_role === "sales"
  ) {
    return {
      ok: false,
      error:
        "Редактирование каталога (JSON) доступно только владельцу организации (owner).",
    };
  }

  const projectId = String(formData.get("project_id") ?? "").trim();
  const rawJson = String(formData.get("draft_json") ?? "").trim();
  if (!projectId || !rawJson) {
    return { ok: false, error: "Пустой черновик" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "Некорректный JSON" };
  }
  try {
    catalogProjectSchema.parse(parsed);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Схема каталога не совпадает",
    };
  }

  const { error } = await supabase
    .from("catalog_projects")
    .update({
      draft_payload: parsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/partner/projects");
  revalidatePath(`/partner/projects/${projectId}`);
  return { ok: true };
}

export async function submitProjectForModeration(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Настройте Supabase" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Войдите в кабинет" };

  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!projectId) return { ok: false, error: "Нет project_id" };

  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role, partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") {
    return { ok: false, error: "Нужна роль partner и организация" };
  }
  if (prof.partner_role === "sales") {
    return {
      ok: false,
      error:
        "Отправка на модерацию доступна владельцу организации (owner).",
    };
  }

  if (!hasSupabaseServiceConfig()) {
    return { ok: false, error: "Сервер: задайте SUPABASE_SERVICE_ROLE_KEY" };
  }
  const admin = createServiceRoleClient();

  const { data: row, error: fetchErr } = await admin
    .from("catalog_projects")
    .select("id, org_id, payload, draft_payload, moderation_status")
    .eq("id", projectId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message ?? "Проект не найден" };
  }
  if (row.org_id !== prof.org_id) {
    return { ok: false, error: "Проект не принадлежит вашей организации" };
  }

  const draft = row.draft_payload ?? row.payload;
  if (!draft) {
    return { ok: false, error: "Нет черновика для отправки" };
  }
  try {
    catalogProjectSchema.parse(draft);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Черновик не проходит валидацию",
    };
  }

  const { count: pending } = await admin
    .from("moderation_submissions")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .eq("status", "pending");

  if ((pending ?? 0) > 0) {
    return { ok: false, error: "Уже есть заявка на модерации" };
  }

  const baseline =
    row.moderation_status === "published" ? row.payload : null;

  const { error: insErr } = await admin.from("moderation_submissions").insert({
    entity_type: "project",
    entity_id: projectId,
    submitted_by: user.id,
    snapshot: draft,
    baseline_snapshot: baseline,
    status: "pending",
  });

  if (insErr) return { ok: false, error: insErr.message };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (row.moderation_status !== "published") {
    updates.moderation_status = "pending_review";
  }

  const { error: upErr } = await admin
    .from("catalog_projects")
    .update(updates)
    .eq("id", projectId);

  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/admin/moderation");
  revalidatePath("/partner/projects");
  revalidatePath(`/partner/projects/${projectId}`);
  return { ok: true };
}

/** Maps SQL function errors (RAISE ... USING MESSAGE) to operator-facing text. */
function rpcErrorMessage(message: string): string {
  if (message.includes("already_processed")) return "Заявка уже обработана";
  if (message.includes("submission_not_found")) return "Заявка не найдена";
  if (message.includes("request_not_found")) return "Запрос не найден";
  if (message.includes("entity_not_found")) return "Проект не найден";
  if (message.includes("project_owned_by_other_org")) {
    return "Проект уже привязан к другой организации";
  }
  return message;
}

export async function approveModerationSubmission(
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { data: sub, error: sErr } = await admin
      .from("moderation_submissions")
      .select("entity_type, snapshot, status")
      .eq("id", submissionId)
      .maybeSingle();

    if (sErr || !sub) {
      return { ok: false, error: sErr?.message ?? "Заявка не найдена" };
    }
    if (sub.status !== "pending") {
      return { ok: false, error: "Заявка уже обработана" };
    }

    // Re-validate: a snapshot must satisfy the strict taxonomy before it can go public.
    if (sub.entity_type === "project") {
      const v = catalogProjectSchema.safeParse(sub.snapshot);
      if (!v.success) {
        return {
          ok: false,
          error: `Снимок не проходит валидацию: ${v.error.issues[0]?.path.join(".")} — ${v.error.issues[0]?.message}`,
        };
      }
    }

    // One transaction in the database: publish + mark approved + audit row, or nothing.
    const { error } = await admin.rpc("moderation_approve", {
      p_submission_id: submissionId,
    });
    if (error) return { ok: false, error: rpcErrorMessage(error.message) };

    revalidatePath("/admin/moderation");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function rejectModerationSubmission(
  submissionId: string,
  reviewerNote: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { error } = await admin.rpc("moderation_reject", {
      p_submission_id: submissionId,
      p_note: reviewerNote.slice(0, 4000),
    });
    if (error) return { ok: false, error: rpcErrorMessage(error.message) };

    revalidatePath("/admin/moderation");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function grantCorrectionRequest(
  requestId: string,
  adminNote?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { error } = await admin.rpc("correction_grant", {
      p_request_id: requestId,
      p_admin_note: (adminNote ?? "").slice(0, 4000),
    });
    if (error) return { ok: false, error: rpcErrorMessage(error.message) };

    revalidatePath("/admin/corrections");
    revalidatePath("/partner/corrections");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function closeCorrectionRequest(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { error } = await admin
      .from("correction_requests")
      .update({
        status: "closed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/corrections");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}
