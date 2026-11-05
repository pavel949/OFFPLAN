export type DirectoryDeveloper = {
  id: string; code: string; name_en: string; name_ru: string; website: string | null;
  org_id: string | null; admin_revision: number;
};
export type DeveloperInput = { id: string | null; revision: number; name_en: string; name_ru: string; website: string; org_id: string | null };
export function parseDeveloperInput(fd: FormData): { ok: true; value: DeveloperInput } | { ok: false; error: string } {
  const text = (key: string) => String(fd.get(key) ?? "").trim();
  const id = text("id") || null, org_id = text("org_id") || null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if ((id && !uuid.test(id)) || (org_id && !uuid.test(org_id))) return { ok: false, error: "Некорректная запись справочника" };
  const name_en = text("name_en"), name_ru = text("name_ru") || name_en, website = text("website");
  if ([name_en, name_ru].some(name => name.length < 2 || name.length > 200)) return { ok: false, error: "Название: от 2 до 200 символов" };
  if (website) {
    try { const url = new URL(website); if (url.protocol !== "https:" || url.username || url.password || website.length > 500) throw new Error(); }
    catch { return { ok: false, error: "Сайт: корректная ссылка https:// без логина и пароля" }; }
  }
  const revision = Number(text("revision") || 0);
  if (!Number.isSafeInteger(revision) || revision < 0 || (id && revision < 1)) return { ok: false, error: "Обновите страницу перед сохранением" };
  return { ok: true, value: { id, revision, name_en, name_ru, website, org_id } };
}

/** Keep a newly created record's identity through validation/server errors on later edits. */
export function retainDeveloperIdentity(
  previous: { id?: string; revision?: number },
  result: { ok: boolean; error?: string; id?: string; revision?: number },
) {
  return result.ok ? result : { ...previous, ...result };
}
