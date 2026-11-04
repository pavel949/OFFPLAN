"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import {
  DriveError,
  fetchFileText,
  getFileMeta,
  hasDriveConfig,
  listFolder,
  serviceAccount,
} from "@/lib/drive/client";
import { isExcel, isImportable, rankFiles, type DriveFile } from "@/lib/drive/pick";
import { parseDriveUrl } from "@/lib/drive/url";
import { runUnitImport, type ImportState } from "@/lib/inventory/run";
import { insertCatalogAuditLog } from "@/lib/marketplace/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

export type DriveListState = {
  ok: boolean;
  error?: string;
  files?: (DriveFile & { importable: boolean; excel: boolean })[];
  serviceAccountEmail?: string | null;
};

type Ctx = {
  db: ReturnType<typeof createServiceRoleClient>;
  userId: string | null;
  scope: "partner" | "admin";
  projectId: string;
  url: string;
};

/**
 * Resolve the source for the caller. Partner: the row is read through RLS (own projects only).
 * Folder sync must have been enabled by IE (`sync_enabled`), so no developer can point the
 * service account at someone else's folder.
 */
async function resolve(scope: "partner" | "admin", sourceId: string): Promise<Ctx | string> {
  if (!hasDriveConfig()) return "Google Drive не настроен на сервере (GOOGLE_SERVICE_ACCOUNT_JSON).";
  if (!hasSupabaseServiceConfig()) return "Не задан SUPABASE_SERVICE_ROLE_KEY.";
  let db: Ctx["db"];
  let userId: string | null = null;
  if (scope === "admin") {
    if (!(await getAdminSessionOk())) return "Нужен вход в панель IE";
    db = createServiceRoleClient();
  } else {
    const c = await createSupabaseServerClient();
    if (!c) return "Нет подключения к базе";
    const {
      data: { user },
    } = await c.auth.getUser();
    if (!user) return "Войдите в кабинет";
    const { data: prof } = await c
      .from("profiles")
      .select("role, org_id, partner_role")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.role !== "partner" || !prof.org_id || prof.partner_role === "sales")
      return "Синхронизацию запускает владелец организации";
    db = c as unknown as Ctx["db"];
    userId = user.id;
  }
  const { data: src } = await db
    .from("project_sources")
    .select("id, project_id, url, sync_enabled")
    .eq("id", sourceId)
    .maybeSingle();
  if (!src) return "Источник не найден";
  if (!src.sync_enabled)
    return "Синхронизация для этой ссылки ещё не включена командой IE. Откройте доступ папки для сервисного аккаунта и напишите нам.";
  return { db, userId, scope, projectId: src.project_id as string, url: src.url as string };
}

function msg(e: unknown): string {
  return e instanceof DriveError ? e.message : "Не удалось связаться с Google Drive.";
}

async function filesOf(ctx: Ctx): Promise<DriveFile[]> {
  const ref = parseDriveUrl(ctx.url);
  if (!ref) throw new DriveError("Ссылка не похожа на Google Drive.", "unsupported");
  if (ref.kind === "folder") return rankFiles(await listFolder(ref.id));
  return [await getFileMeta(ref.id)];
}

async function list(scope: "partner" | "admin", sourceId: string): Promise<DriveListState> {
  const ctx = await resolve(scope, sourceId);
  if (typeof ctx === "string") return { ok: false, error: ctx };
  try {
    const files = await filesOf(ctx);
    return {
      ok: true,
      serviceAccountEmail: serviceAccount()?.client_email ?? null,
      files: files.map((f) => ({ ...f, importable: isImportable(f), excel: isExcel(f) })),
    };
  } catch (e) {
    return { ok: false, error: msg(e), serviceAccountEmail: serviceAccount()?.client_email ?? null };
  }
}
export async function partnerDriveList(sourceId: string) {
  return list("partner", sourceId);
}
export async function adminDriveList(sourceId: string) {
  return list("admin", sourceId);
}

async function importFile(scope: "partner" | "admin", f: FormData): Promise<ImportState> {
  const sourceId = String(f.get("source_id") ?? "");
  const fileId = String(f.get("file_id") ?? "");
  const mode = f.get("mode") === "apply" ? "apply" : "preview";
  const ctx = await resolve(scope, sourceId);
  if (typeof ctx === "string") return { ok: false, error: ctx };
  try {
    // only files that really belong to the linked folder / file can be read
    const file = (await filesOf(ctx)).find((x) => x.id === fileId);
    if (!file) return { ok: false, error: "Файл не найден в папке" };
    if (isExcel(file))
      return {
        ok: false,
        error: "Файлы Excel (.xlsx) пока не читаются: откройте файл в Google Таблицах (Файл → Сохранить как Google Таблицу) или выгрузите CSV.",
      };
    if (!isImportable(file)) return { ok: false, error: "Этот тип файла нельзя импортировать (нужна Google Таблица или CSV)." };
    const text = await fetchFileText(file);
    const res = await runUnitImport({
      db: ctx.db,
      projectId: ctx.projectId,
      text,
      mode,
      source: "import",
      actorId: ctx.userId,
    });
    if (res.ok && res.mode === "apply") {
      // bookkeeping needs the trusted client: developers cannot write sync fields themselves
      const admin = createServiceRoleClient();
      await admin
        .from("project_sources")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_note: `${file.name}: +${res.applied?.inserted ?? 0} / ~${res.applied?.updated ?? 0}`.slice(0, 500),
          confirmed_at: new Date().toISOString(),
          confirmed_by: ctx.userId,
        })
        .eq("id", sourceId);
      void insertCatalogAuditLog({
        entity_type: "unit",
        entity_id: ctx.projectId,
        actor_id: ctx.userId,
        action: "units_imported_drive",
        diff: { file: file.name, ...res.applied },
      });
      revalidatePath("/");
      revalidatePath(`/partner/projects/${ctx.projectId}/materials`);
      revalidatePath(`/partner/projects/${ctx.projectId}/inventory`);
      revalidatePath(`/admin/projects/${ctx.projectId}`);
    }
    return res;
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
export async function partnerDriveImport(_: ImportState, f: FormData) {
  return importFile("partner", f);
}
export async function adminDriveImport(_: ImportState, f: FormData) {
  return importFile("admin", f);
}

/** IE staff only: switch folder sync on/off for a source. */
export async function adminSetSourceSync(
  sourceId: string,
  projectId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await getAdminSessionOk())) return { ok: false, error: "Нужен вход в панель IE" };
  if (!hasSupabaseServiceConfig()) return { ok: false, error: "Не задан SUPABASE_SERVICE_ROLE_KEY" };
  const db = createServiceRoleClient();
  const { data: src } = await db.from("project_sources").select("url").eq("id", sourceId).eq("project_id", projectId).maybeSingle();
  if (!src) return { ok: false, error: "Источник не найден" };
  if (enabled && !parseDriveUrl(src.url as string))
    return { ok: false, error: "Это не ссылка Google Drive / Google Таблицы" };
  const { error } = await db.from("project_sources").update({ sync_enabled: enabled }).eq("id", sourceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/partner/projects/${projectId}/materials`);
  return { ok: true };
}
