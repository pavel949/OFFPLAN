"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { evidenceSchema, PHOTO_PATH_RE, projectPhotoUrl } from "@/lib/project-evidence";
import { catalogProjectSchema } from "@/lib/schema";
import { parseWizardForm } from "@/lib/project-wizard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";
type State = { ok: boolean; error?: string };
export async function submitProjectEvidence(
  _: State,
  f: FormData,
): Promise<State> {
  try {
    const db = await createSupabaseServerClient();
    if (!db) return { ok: false, error: "Нет подключения к базе" };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "Войдите" };
    const parsed = evidenceSchema.safeParse({
      project_id: f.get("project_id"),
      kind: f.get("kind"),
      fact_key: f.get("fact_key"),
      title: f.get("title"),
      source_url: f.get("source_url"),
      observed_at: f.get("observed_at"),
      details: JSON.parse(String(f.get("details") ?? "{}")),
    });
    if (!parsed.success)
      return { ok: false, error: parsed.error.issues[0]?.message };
    const { error } = await db
      .from("project_evidence")
      .insert({ ...parsed.data, submitted_by: user.id, status: "pending" });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/partner/projects/${parsed.data.project_id}/facts`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка данных",
    };
  }
}
/** Files were already uploaded by the browser to the `project-photos` bucket; register them as pending photo evidence. */
export async function submitUploadedPhotos(input: {
  projectId: string;
  observedAt: string;
  items: { path: string; caption: string }[];
}): Promise<State & { saved?: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return { ok: false, error: "Нет подключения к базе" };
  const db = await createSupabaseServerClient();
  if (!db) return { ok: false, error: "Нет подключения к базе" };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Войдите" };
  if (!input.items.length || input.items.length > 40)
    return { ok: false, error: "Загрузите от 1 до 40 фотографий за раз" };
  const rows = [];
  for (const it of input.items) {
    if (!PHOTO_PATH_RE.test(it.path) || !it.path.startsWith(`${input.projectId}/`))
      return { ok: false, error: "Некорректный путь файла" };
    const parsed = evidenceSchema.safeParse({
      project_id: input.projectId,
      kind: "photo",
      fact_key: `photo-${it.path.split("/")[1]}`.slice(0, 100),
      title: it.caption.trim().slice(0, 300) || "Фото проекта",
      source_url: projectPhotoUrl(url, it.path),
      observed_at: input.observedAt,
      details: {
        url: projectPhotoUrl(url, it.path),
        caption: it.caption.trim().slice(0, 300) || "Фото проекта",
      },
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    rows.push({ ...parsed.data, submitted_by: user.id, status: "pending" });
  }
  const { error } = await db.from("project_evidence").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/partner/projects/${input.projectId}/facts`);
  return { ok: true, saved: rows.length };
}

export async function reviewProjectEvidence(f: FormData) {
  if (!(await getAdminSessionOk())) throw Error("Нужен вход администратора");
  if (!hasSupabaseServiceConfig())
    throw Error("Серверный доступ к базе не настроен");
  const { error } = await createServiceRoleClient().rpc(
    "review_project_evidence",
    { p_id: String(f.get("id")), p_approve: f.get("approve") === "yes" },
  );
  if (error) throw Error(error.message);
  revalidatePath("/admin/evidence");
  revalidatePath("/");
  revalidatePath("/project", "layout");
}
export async function createPartnerProject(
  _: State,
  f: FormData,
): Promise<State> {
  const db = await createSupabaseServerClient();
  if (!db) return { ok: false, error: "Нет подключения к базе" };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Войдите" };
  const { data: profile } = await db
    .from("profiles")
    .select("org_id,role,partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profile?.role !== "partner" ||
    !profile.org_id ||
    profile.partner_role === "sales"
  )
    return { ok: false, error: "Проекты добавляет владелец организации" };
  let payload;
  try {
    payload = catalogProjectSchema.parse(
      JSON.parse(String(f.get("draft_json"))),
    );
  } catch {
    return {
      ok: false,
      error: "Проверьте JSON проекта; неизвестные сведения нельзя выдумывать",
    };
  }
  const { data, error } = await db
    .from("catalog_projects")
    .insert({
      slug: `draft-${randomUUID()}`,
      org_id: profile.org_id,
      payload,
      draft_payload: payload,
      is_published: false,
      moderation_status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/partner/projects");
  redirect(`/partner/projects/${data.id}`);
}

/** Wizard variant of `createPartnerProject`: plain fields instead of a JSON blob. */
export async function createPartnerProjectFromWizard(
  _: State,
  f: FormData,
): Promise<State> {
  const db = await createSupabaseServerClient();
  if (!db) return { ok: false, error: "Нет подключения к базе" };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Войдите" };
  const { data: profile } = await db
    .from("profiles")
    .select("org_id,role,partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (
    profile?.role !== "partner" ||
    !profile.org_id ||
    profile.partner_role === "sales"
  )
    return { ok: false, error: "Проекты добавляет владелец организации" };
  const parsed = parseWizardForm(f);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { data, error } = await db
    .from("catalog_projects")
    .insert({
      slug: `draft-${randomUUID()}`,
      org_id: profile.org_id,
      payload: parsed.payload,
      draft_payload: parsed.payload,
      is_published: false,
      moderation_status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/partner/projects");
  redirect(`/partner/projects/${data.id}/materials`);
}

/** Operator (IE admin) creates a project, optionally for a developer organisation, optionally publishing at once. */
export async function adminCreateProjectFromWizard(
  _: State,
  f: FormData,
): Promise<State> {
  if (!(await getAdminSessionOk())) return { ok: false, error: "Нужен вход в панель IE" };
  if (!hasSupabaseServiceConfig())
    return { ok: false, error: "Не задан SUPABASE_SERVICE_ROLE_KEY" };
  const parsed = parseWizardForm(f);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const orgId = String(f.get("org_id") ?? "").trim() || null;
  const publish = f.get("publish") === "yes";
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from("catalog_projects")
    .insert({
      slug: `draft-${randomUUID()}`,
      org_id: orgId,
      payload: parsed.payload,
      draft_payload: parsed.payload,
      is_published: false,
      moderation_status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (publish) {
    const { data: sub, error: sErr } = await db
      .from("moderation_submissions")
      .insert({
        entity_type: "project",
        entity_id: data.id,
        submitted_by: null,
        snapshot: parsed.payload,
        status: "pending",
      })
      .select("id")
      .single();
    if (sErr) return { ok: false, error: sErr.message };
    const { error: aErr } = await db.rpc("moderation_approve", {
      p_submission_id: sub.id,
    });
    if (aErr) return { ok: false, error: aErr.message };
    revalidatePath("/");
  }
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${data.id}`);
}
