"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/owner";
import { CLEARVIEW_V22, ATLAS_V21, isCvConfig, nextVersion, validateConfig, type CvConfig } from "@/lib/clearview/config";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

type Res = { ok: boolean; error?: string };
/** Only the platform owner (a signed-in person recognised by the database) edits methodology. */
async function admin() {
  await requireOwner();
  if (!hasSupabaseServiceConfig()) throw new Error("Не задан SUPABASE_SERVICE_ROLE_KEY");
  return createServiceRoleClient();
}
const msg = (e: unknown) => (e instanceof Error ? e.message : "Ошибка");

export type VersionRow = {
  id: string; version: string; title: string; status: "draft" | "review" | "published" | "retired";
  config_hash: string | null; approval_mode: "dual" | "owner" | null; change_summary: string; published_at: string | null; submitted_at: string | null;
  created_at: string; approvals: number; returns: number;
};

export async function cvListVersions(): Promise<VersionRow[]> {
  const db = await admin();
  const [v, a] = await Promise.all([
    db.from("cv_methodology_versions").select("id, version, title, status, config_hash, approval_mode, change_summary, published_at, submitted_at, created_at").eq("jurisdiction_code", "TH").order("created_at", { ascending: false }),
    db.from("cv_methodology_approvals").select("version_id, decision"),
  ]);
  if (v.error) throw new Error(v.error.message);
  const count = (id: string, d: string) => (a.data ?? []).filter((x) => x.version_id === id && x.decision === d).length;
  return (v.data ?? []).map((r) => ({ ...(r as Omit<VersionRow, "approvals" | "returns">), approvals: count(r.id as string, "approve"), returns: count(r.id as string, "return") }));
}

export async function cvGetVersion(id: string): Promise<{ row: VersionRow; config: CvConfig; baseline: CvConfig; baselineLabel: string }> {
  const db = await admin();
  const { data, error } = await db.from("cv_methodology_versions").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Версия не найдена");
  if (!isCvConfig(data.config)) throw new Error("Содержимое версии повреждено");
  const { data: pub } = await db.from("cv_methodology_versions").select("version, config").eq("jurisdiction_code", "TH").eq("status", "published").maybeSingle();
  const baseline = pub && isCvConfig(pub.config) ? pub.config : ATLAS_V21;
  const approvals = await db.from("cv_methodology_approvals").select("decision").eq("version_id", id);
  return {
    row: { ...(data as unknown as VersionRow), approvals: (approvals.data ?? []).filter((x) => x.decision === "approve").length, returns: (approvals.data ?? []).filter((x) => x.decision === "return").length },
    config: data.config,
    baseline,
    baselineLabel: pub ? `Действующая версия ${pub.version}` : "Atlas v2.1 как опубликован",
  };
}

/** New draft from the published version, or from the recommended 2.2 when nothing is published yet. */
export async function cvCreateDraft(): Promise<Res & { id?: string }> {
  try {
    const db = await admin();
    const { data: all, error: listError } = await db.from("cv_methodology_versions").select("id, version, status, config").eq("jurisdiction_code", "TH");
    if (listError) return { ok: false, error: listError.message };
    const pub = (all ?? []).find((r) => r.status === "published");
    const config: CvConfig = pub && isCvConfig(pub.config) ? pub.config : CLEARVIEW_V22;
    const version = nextVersion((all ?? []).map((r) => r.version as string));
    const { data, error } = await db.from("cv_methodology_versions").insert({
      jurisdiction_code: "TH", version, title: `ClearView ${version}`, config: { ...config, version, title: `ClearView ${version}` }, based_on: pub?.id ?? null,
    }).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/owner/methodology");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cvSaveDraft(id: string, config: CvConfig): Promise<Res & { errors?: string[]; warnings?: string[] }> {
  try {
    const db = await admin();
    if (!isCvConfig(config) || typeof config.title !== "string" || JSON.stringify(config).length > 400_000) return { ok: false, error: "Некорректная структура методологии" };
    const v = validateConfig(config);
    const { data, error } = await db.from("cv_methodology_versions").update({ config, title: config.title.slice(0, 200) })
      .eq("id", id).eq("jurisdiction_code", "TH").eq("version", config.version).eq("status", "draft").select("id").maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Черновик больше недоступен" };
    return { ok: true, errors: v.errors, warnings: v.warnings };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cvDeleteDraft(id: string): Promise<Res> {
  try {
    const db = await admin();
    const { data, error } = await db.from("cv_methodology_versions").delete()
      .eq("id", id).eq("jurisdiction_code", "TH").eq("status", "draft").select("id").maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Черновик больше недоступен" };
    revalidatePath("/owner/methodology");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cvSubmit(id: string, config: CvConfig, summary: string): Promise<Res> {
  try {
    const db = await admin();
    if (!isCvConfig(config) || typeof config.title !== "string" || JSON.stringify(config).length > 400_000) return { ok: false, error: "Некорректная структура методологии" };
    const v = validateConfig(config);
    if (!v.ok) return { ok: false, error: `Исправьте ошибки: ${v.errors[0]}` };
    const { error } = await db.rpc("cv_submit_for_review", { p_id: id, p_summary: summary, p_config: config });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/owner/methodology");
    revalidatePath("/registry/methodology");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * The owner publishes alone. This is a recorded, public choice: the version carries approval_mode = 'owner',
 * so the site never claims that two independent analysts approved it.
 */
export async function cvPublishNow(id: string, config: CvConfig, summary: string): Promise<Res> {
  try {
    const owner = await requireOwner();
    if (!hasSupabaseServiceConfig()) return { ok: false, error: "Не задан SUPABASE_SERVICE_ROLE_KEY" };
    const db = createServiceRoleClient();
    if (!isCvConfig(config) || typeof config.title !== "string" || JSON.stringify(config).length > 400_000) return { ok: false, error: "Некорректная структура методологии" };
    const v = validateConfig(config);
    if (!v.ok) return { ok: false, error: `Исправьте ошибки: ${v.errors[0]}` };
    if (typeof summary !== "string" || summary.trim().length < 20 || summary.trim().length > 4000) {
      return { ok: false, error: "Опишите изменение (20–4000 символов): оно станет публичным" };
    }
    const { error } = await db.rpc("cv_owner_publish", { p_id: id, p_owner_id: owner.id, p_config: config, p_summary: summary });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/owner/methodology");
    revalidatePath("/methodology");
    revalidatePath("/registry/methodology");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
