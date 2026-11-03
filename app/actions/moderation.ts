"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { insertCatalogAuditLog } from "@/lib/marketplace/audit";
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

export async function approveModerationSubmission(
  submissionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const { data: sub, error: sErr } = await admin
      .from("moderation_submissions")
      .select("*")
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

    // Optimistic claim: only one reviewer can move pending -> approved.
    const now = new Date().toISOString();
    const { data: claimed, error: cErr } = await admin
      .from("moderation_submissions")
      .update({ status: "approved", reviewed_at: now })
      .eq("id", submissionId)
      .eq("status", "pending")
      .select("id");
    if (cErr) return { ok: false, error: cErr.message };
    if (!claimed?.length) return { ok: false, error: "Заявка уже обработана" };

    const revert = async () => {
      await admin
        .from("moderation_submissions")
        .update({ status: "pending", reviewed_at: null })
        .eq("id", submissionId);
    };

    if (sub.entity_type === "project") {
      const { data: proj } = await admin
        .from("catalog_projects")
        .select("id, moderation_status")
        .eq("id", sub.entity_id)
        .maybeSingle();

      if (!proj) {
        await revert();
        return { ok: false, error: "Проект не найден" };
      }

      const { error: pErr } = await admin
        .from("catalog_projects")
        .update({
          payload: sub.snapshot,
          draft_payload: null,
          moderation_status: "published",
          is_published: true,
          updated_at: now,
        })
        .eq("id", sub.entity_id);

      if (pErr) {
        await revert();
        return { ok: false, error: pErr.message };
      }
    } else if (sub.entity_type === "org") {
      const { error: oErr } = await admin
        .from("orgs")
        .update({
          profile_published: sub.snapshot,
          profile_draft: null,
          org_moderation_status: "published",
          updated_at: now,
        })
        .eq("id", sub.entity_id);

      if (oErr) {
        await revert();
        return { ok: false, error: oErr.message };
      }
    }

    await insertCatalogAuditLog({
      entity_type: "moderation",
      entity_id: submissionId,
      actor_id: null, // shared admin login has no user identity yet
      action: "moderation_approved",
      diff: { entity_type: sub.entity_type, entity_id: sub.entity_id },
    });

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
    const { data: sub } = await admin
      .from("moderation_submissions")
      .select("id, entity_type, entity_id, status")
      .eq("id", submissionId)
      .maybeSingle();

    if (!sub) return { ok: false, error: "Заявка не найдена" };
    if (sub.status !== "pending") {
      return { ok: false, error: "Заявка уже обработана" };
    }

    if (sub.entity_type === "project") {
      const { data: proj } = await admin
        .from("catalog_projects")
        .select("moderation_status")
        .eq("id", sub.entity_id)
        .maybeSingle();

      if (proj?.moderation_status === "pending_review") {
        await admin
          .from("catalog_projects")
          .update({
            moderation_status: "rejected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.entity_id);
      }
    }

    const { error: uErr } = await admin
      .from("moderation_submissions")
      .update({
        status: "rejected",
        reviewer_note: reviewerNote.slice(0, 4000),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (uErr) return { ok: false, error: uErr.message };

    await insertCatalogAuditLog({
      entity_type: "moderation",
      entity_id: submissionId,
      actor_id: null,
      action: "moderation_rejected",
      diff: { note: reviewerNote.slice(0, 500) },
    });

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
    const { data: req } = await admin
      .from("correction_requests")
      .select("id, project_id, org_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!req) return { ok: false, error: "Запрос не найден" };
    if (req.status !== "open") {
      return { ok: false, error: "Запрос уже обработан" };
    }

    const { data: proj } = await admin
      .from("catalog_projects")
      .select("id, org_id, payload, draft_payload")
      .eq("id", req.project_id)
      .maybeSingle();

    if (!proj) return { ok: false, error: "Проект не найден" };

    if (proj.org_id && proj.org_id !== req.org_id) {
      return {
        ok: false,
        error: "Проект уже привязан к другой организации",
      };
    }

    const patch: Record<string, unknown> = {
      org_id: req.org_id,
      updated_at: new Date().toISOString(),
    };
    if (proj.draft_payload == null && proj.payload) {
      patch.draft_payload = proj.payload;
    }

    const { error: pErr } = await admin
      .from("catalog_projects")
      .update(patch)
      .eq("id", req.project_id);

    if (pErr) return { ok: false, error: pErr.message };

    const { error: rErr } = await admin
      .from("correction_requests")
      .update({
        status: "granted",
        admin_note: (adminNote ?? "").slice(0, 4000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (rErr) return { ok: false, error: rErr.message };

    await insertCatalogAuditLog({
      entity_type: "correction",
      entity_id: requestId,
      actor_id: null,
      action: "correction_granted",
      diff: { project_id: req.project_id, org_id: req.org_id },
    });

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
