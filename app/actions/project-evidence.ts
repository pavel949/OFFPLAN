"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { evidenceSchema } from "@/lib/project-evidence";
import { catalogProjectSchema } from "@/lib/schema";
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
