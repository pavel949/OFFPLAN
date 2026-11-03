"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { runUnitImport, type ImportState } from "@/lib/inventory/run";
import { insertCatalogAuditLog } from "@/lib/marketplace/audit";
import { parseWhatsAppText } from "@/lib/whatsapp-parse";
import { catalogProjectSchema } from "@/lib/schema";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

async function requireAdmin(): Promise<
  ReturnType<typeof createServiceRoleClient>
> {
  if (!(await getAdminSessionOk())) {
    throw new Error("Нужен вход в панель IE");
  }
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Задайте SUPABASE_SERVICE_ROLE_KEY и URL");
  }
  return createServiceRoleClient();
}

export type AdminProjectRow = {
  id: string;
  slug: string;
  legacy_id: number | null;
  moderation_status: string;
  name: string;
};

export async function adminListProjects(): Promise<AdminProjectRow[]> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("catalog_projects")
    .select("id, slug, legacy_id, moderation_status, payload")
    .order("slug");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const payload = r.payload as { n?: string };
    return {
      id: r.id,
      slug: r.slug,
      legacy_id: r.legacy_id,
      moderation_status: r.moderation_status,
      name: typeof payload?.n === "string" ? payload.n : r.slug,
    };
  });
}

export async function adminGetProjectPayload(projectId: string): Promise<{
  slug: string;
  moderation_status: string;
  payload: unknown;
}> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("catalog_projects")
    .select("slug, moderation_status, payload")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Проект не найден");
  return {
    slug: data.slug,
    moderation_status: data.moderation_status,
    payload: data.payload,
  };
}

export async function adminSaveProjectPayload(
  projectId: string,
  jsonText: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await requireAdmin();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return { ok: false, error: "Некорректный JSON" };
    }
    try {
      catalogProjectSchema.parse(parsed);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Схема каталога",
      };
    }

    const { data: row } = await supabase
      .from("catalog_projects")
      .select("slug")
      .eq("id", projectId)
      .maybeSingle();

    const { error } = await supabase
      .from("catalog_projects")
      .update({
        payload: parsed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/");
    revalidatePath("/admin/projects");
    if (row?.slug) revalidatePath(`/project/${row.slug}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function adminGetPlatformSettings(): Promise<
  Record<string, unknown>
> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.from("platform_settings").select("key, value");
  if (error) throw new Error(error.message);
  const out: Record<string, unknown> = {};
  for (const row of data ?? []) {
    out[row.key] = row.value;
  }
  return out;
}

export async function adminSaveRatingMethodology(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const supabase = await requireAdmin();
    const ru = String(formData.get("ru") ?? "");
    const en = String(formData.get("en") ?? "");
    const weightsJson = String(formData.get("weights") ?? "{}");
    let weights: unknown = {};
    try {
      weights = JSON.parse(weightsJson || "{}");
    } catch {
      return { ok: false, error: "weights: невалидный JSON" };
    }

    const value = { ru, en, weights };
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: "rating_methodology",
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function adminSaveCatalogHeadline(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const supabase = await requireAdmin();
    const totalValueBnTHB = Number(formData.get("totalValueBnTHB") ?? 71);
    const quarterLabel = String(formData.get("quarterLabel") ?? "Q2 2026");
    const value = {
      totalValueBnTHB: Number.isFinite(totalValueBnTHB) ? totalValueBnTHB : 71,
      quarterLabel,
    };
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: "catalog_headline",
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/");
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export type ProjectDocRow = {
  id: string;
  kind: string;
  title: string;
  storage_path: string;
  mime: string;
  file_size: number;
  notes: string;
  created_at: string;
};

export async function adminListProjectDocuments(
  projectId: string,
): Promise<ProjectDocRow[]> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("project_documents")
    .select("id, kind, title, storage_path, mime, file_size, notes, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectDocRow[];
}

export async function adminUploadProjectDocument(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const projectId = String(formData.get("project_id") ?? "");
    const kind = String(formData.get("kind") ?? "other");
    const title = String(formData.get("title") ?? "file");
    const notes = String(formData.get("notes") ?? "");
    const file = formData.get("file");
    if (!projectId || !(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Файл и проект обязательны" };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/${Date.now()}_${safeName}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from("project-docs")
      .upload(path, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) return { ok: false, error: upErr.message };

    const { error: insErr } = await supabase.from("project_documents").insert({
      project_id: projectId,
      kind: ["memo", "marketing", "legal", "plan", "other"].includes(kind)
        ? kind
        : "other",
      title: title || safeName,
      storage_path: path,
      mime: file.type || "application/octet-stream",
      file_size: file.size,
      notes,
    });
    if (insErr) return { ok: false, error: insErr.message };

    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка загрузки",
    };
  }
}

export async function adminDeleteProjectDocument(
  docId: string,
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const { data: row } = await supabase
      .from("project_documents")
      .select("storage_path")
      .eq("id", docId)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("project-docs").remove([row.storage_path]);
    }
    const { error } = await supabase
      .from("project_documents")
      .delete()
      .eq("id", docId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function adminGetDocumentSignedUrl(
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const { data, error } = await supabase.storage
      .from("project-docs")
      .createSignedUrl(storagePath, 3600);
    if (error) return { error: error.message };
    return { url: data.signedUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка" };
  }
}

export async function adminSaveWhatsAppIngest(
  _prev: { ok: boolean; error?: string; id?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const supabase = await requireAdmin();
    const raw = String(formData.get("raw_text") ?? "");
    const label = String(formData.get("source_label") ?? "paste");
    if (!raw.trim()) return { ok: false, error: "Вставьте текст" };

    const parsed = parseWhatsAppText(raw);
    const { data, error } = await supabase
      .from("whatsapp_ingests")
      .insert({
        source_label: label,
        raw_text: raw.slice(0, 500_000),
        parsed: parsed as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/ingest/whatsapp");
    return { ok: true, id: data?.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Ошибка",
    };
  }
}

export async function adminListWhatsAppIngests(limit = 50): Promise<
  { id: string; source_label: string; created_at: string; preview: string }[]
> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("whatsapp_ingests")
    .select("id, source_label, raw_text, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    source_label: r.source_label,
    created_at: r.created_at,
    preview: (r.raw_text as string).slice(0, 120).replace(/\s+/g, " "),
  }));
}

/** Operator entry of a developer's price list / inventory (source = operator, shown as such). */
export async function adminImportProjectUnits(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  try {
    const db = await requireAdmin();
    const projectId = String(formData.get("project_id") ?? "").trim();
    const text = String(formData.get("text") ?? "");
    const mode = formData.get("mode") === "apply" ? "apply" : "preview";
    if (!projectId) return { ok: false, error: "Нет project_id" };
    const res = await runUnitImport({ db, projectId, text, mode, source: "operator", actorId: null });
    if (res.ok && res.mode === "apply") {
      await insertCatalogAuditLog({
        entity_type: "unit",
        entity_id: projectId,
        actor_id: null,
        action: "units_imported_by_operator",
        diff: { ...res.applied, summary: res.summary },
      });
      revalidatePath("/");
      revalidatePath(`/admin/projects/${projectId}/inventory`);
    }
    return res;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка" };
  }
}

export type OperatorUnitRow = {
  id: string;
  label: string;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price_thb: number | null;
  currency: string;
  status: string;
  source: string;
  price_updated_at: string | null;
};

export async function adminListProjectUnits(projectId: string): Promise<OperatorUnitRow[]> {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("project_units")
    .select("id, label, bedrooms, floor, sqm, price_thb, currency, status, source, price_updated_at")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OperatorUnitRow[];
}

// ---------------- registry: declared commercial interests (drive reviewer recusal) ----------------
export type InterestRow = { org_id: string; kind: string; note: string; org_name: string };

export async function adminListInterests(projectId: string): Promise<{ interests: InterestRow[]; brokers: { id: string; name: string }[] }> {
  const db = await requireAdmin();
  const [i, o] = await Promise.all([
    db.from("project_commercial_interests").select("org_id, kind, note, orgs(name_ru)").eq("project_id", projectId),
    db.from("orgs").select("id, name_ru").eq("kind", "broker").order("name_ru"),
  ]);
  return {
    interests: ((i.data ?? []) as unknown as { org_id: string; kind: string; note: string; orgs: { name_ru: string } | null }[]).map((r) => ({
      org_id: r.org_id,
      kind: r.kind,
      note: r.note,
      org_name: r.orgs?.name_ru ?? r.org_id,
    })),
    brokers: ((o.data ?? []) as { id: string; name_ru: string }[]).map((b) => ({ id: b.id, name: b.name_ru })),
  };
}

export async function adminAddInterest(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await requireAdmin();
    const projectId = String(formData.get("project_id") ?? "");
    const orgId = String(formData.get("org_id") ?? "");
    const kind = String(formData.get("kind") ?? "broker_agreement");
    if (!projectId || !orgId) return { ok: false, error: "Выберите организацию" };
    if (!["broker_agreement", "deal", "other"].includes(kind)) return { ok: false, error: "Некорректный тип" };
    const { error } = await db
      .from("project_commercial_interests")
      .upsert({ project_id: projectId, org_id: orgId, kind, note: String(formData.get("note") ?? "").slice(0, 500) }, { onConflict: "project_id,org_id,kind" });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка" };
  }
}

export async function adminRemoveInterest(projectId: string, orgId: string, kind: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("project_commercial_interests").delete().eq("project_id", projectId).eq("org_id", orgId).eq("kind", kind);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка" };
  }
}
