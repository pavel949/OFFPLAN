"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { sourceInputSchema, type ProjectSourceRow } from "@/lib/sources";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

export type SourceState = { ok: boolean; error?: string };

type Db = ReturnType<typeof createServiceRoleClient>;
type Actor = { db: Db; userId: string | null; scope: "partner" | "admin" };

/** Partner: RLS (policies on project_sources) restricts every statement to the user's own projects. */
async function partnerActor(): Promise<Actor | string> {
  const db = await createSupabaseServerClient();
  if (!db) return "Нет подключения к базе";
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return "Войдите в кабинет";
  const { data: prof } = await db
    .from("profiles")
    .select("role, org_id, partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.role !== "partner" || !prof.org_id)
    return "Нужна роль застройщика с привязанной организацией";
  if (prof.partner_role === "sales")
    return "Материалы проекта добавляет владелец организации";
  return { db: db as unknown as Db, userId: user.id, scope: "partner" };
}

async function adminActor(): Promise<Actor | string> {
  if (!(await getAdminSessionOk())) return "Нужен вход в панель IE";
  if (!hasSupabaseServiceConfig()) return "Не задан SUPABASE_SERVICE_ROLE_KEY";
  return { db: createServiceRoleClient(), userId: null, scope: "admin" };
}

function pathsFor(a: Actor, projectId: string) {
  return a.scope === "admin"
    ? [`/admin/projects/${projectId}`]
    : [`/partner/projects/${projectId}/materials`];
}

async function saveSource(
  a: Actor,
  formData: FormData,
): Promise<SourceState> {
  const parsed = sourceInputSchema.safeParse({
    project_id: String(formData.get("project_id") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    title: String(formData.get("title") ?? ""),
    url: String(formData.get("url") ?? ""),
    visibility: String(formData.get("visibility") ?? "partners"),
    cadence: String(formData.get("cadence") ?? "none"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const v = parsed.data;
  const { error } = await a.db.from("project_sources").insert({
    ...v,
    created_by: a.userId,
  });
  if (error) return { ok: false, error: "Не удалось сохранить: " + error.message };
  for (const p of pathsFor(a, v.project_id)) revalidatePath(p);
  revalidatePath("/project", "layout");
  return { ok: true };
}

async function deleteSource(a: Actor, id: string, projectId: string): Promise<SourceState> {
  const { error } = await a.db
    .from("project_sources")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  for (const p of pathsFor(a, projectId)) revalidatePath(p);
  revalidatePath("/project", "layout");
  return { ok: true };
}

async function confirmSource(a: Actor, id: string, projectId: string): Promise<SourceState> {
  const { error } = await a.db
    .from("project_sources")
    .update({ confirmed_at: new Date().toISOString(), confirmed_by: a.userId })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  for (const p of pathsFor(a, projectId)) revalidatePath(p);
  revalidatePath("/project", "layout");
  return { ok: true };
}

export async function partnerAddSource(_: SourceState, f: FormData): Promise<SourceState> {
  const a = await partnerActor();
  return typeof a === "string" ? { ok: false, error: a } : saveSource(a, f);
}
export async function partnerDeleteSource(id: string, projectId: string): Promise<SourceState> {
  const a = await partnerActor();
  return typeof a === "string" ? { ok: false, error: a } : deleteSource(a, id, projectId);
}
export async function partnerConfirmSource(id: string, projectId: string): Promise<SourceState> {
  const a = await partnerActor();
  return typeof a === "string" ? { ok: false, error: a } : confirmSource(a, id, projectId);
}

export async function adminAddSource(_: SourceState, f: FormData): Promise<SourceState> {
  const a = await adminActor();
  return typeof a === "string" ? { ok: false, error: a } : saveSource(a, f);
}
export async function adminDeleteSource(id: string, projectId: string): Promise<SourceState> {
  const a = await adminActor();
  return typeof a === "string" ? { ok: false, error: a } : deleteSource(a, id, projectId);
}
export async function adminConfirmSource(id: string, projectId: string): Promise<SourceState> {
  const a = await adminActor();
  return typeof a === "string" ? { ok: false, error: a } : confirmSource(a, id, projectId);
}

export async function adminListSources(projectId: string): Promise<ProjectSourceRow[]> {
  const a = await adminActor();
  if (typeof a === "string") throw new Error(a);
  const { data, error } = await a.db
    .from("project_sources")
    .select("id, project_id, kind, title, url, visibility, cadence, note, confirmed_at, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectSourceRow[];
}
