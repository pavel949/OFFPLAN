"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { parseDeveloperInput } from "@/lib/developer-directory";

export type DeveloperSaveState = { ok: boolean; error?: string; id?: string; revision?: number };
export async function adminSaveDeveloper(_previous: DeveloperSaveState, fd: FormData): Promise<DeveloperSaveState> {
  if (!(await getAdminSessionOk())) return { ok: false, error: "Нужен вход в панель управления" };
  if (!hasSupabaseServiceConfig()) return { ok: false, error: "Хранилище не настроено" };
  const parsed = parseDeveloperInput(fd);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  try {
    const db = createServiceRoleClient();
    const { data, error } = await db.rpc("admin_save_developer_directory", {
      p_id: v.id, p_expected_revision: v.revision, p_code: v.id ? null : `DEV${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      p_name_en: v.name_en, p_name_ru: v.name_ru, p_website: v.website || null, p_org_id: v.org_id,
    });
    if (error) {
      if (error.message.includes("revision conflict")) return { ok: false, error: "Другой редактор изменил запись. Обновите страницу и проверьте новую версию перед повторным сохранением." };
      if (error.code === "PGRST202" || error.code === "42883") return { ok: false, error: "Редактор справочника ещё не подключён. Требуется миграция базы данных." };
      return { ok: false, error: "Не удалось сохранить застройщика. Проверьте поля и связь с организацией." };
    }
    revalidatePath("/admin/developers");
    revalidatePath("/admin/projects");
    revalidatePath("/admin/projects/[id]", "page");
    revalidatePath("/");
    revalidatePath("/market");
    revalidatePath("/developers", "layout");
    revalidatePath("/project", "layout");
    revalidatePath("/locations", "layout");
    return { ok: true, id: data.id, revision: data.revision };
  } catch {
    return { ok: false, error: "Не удалось сохранить. Проверьте запись после восстановления соединения." };
  }
}
