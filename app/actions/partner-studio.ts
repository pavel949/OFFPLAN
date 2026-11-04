"use server";

import { revalidatePath } from "next/cache";
import { catalogProjectSchema } from "@/lib/schema";
import { mergeStudioFields, parseStudioForm } from "@/lib/studio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Res = { ok: boolean; error?: string };

/** Developer saves the structured project form into the DRAFT. Editorial fields and the developer link are never taken from the form. */
export async function partnerSaveDraftFields(projectId: string, _prev: Res, fd: FormData): Promise<Res> {
  try {
    const db = await createSupabaseServerClient();
    if (!db) return { ok: false, error: "Сервис временно недоступен" };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, error: "Войдите в кабинет" };

    const { data: prof } = await db.from("profiles").select("org_id, role, partner_role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "partner" || !prof.org_id) return { ok: false, error: "Кабинет доступен сотрудникам застройщика" };
    if (prof.partner_role === "sales") return { ok: false, error: "Редактировать карточку может владелец организации. Лоты, новости и акции доступны вам." };

    const { data: row } = await db
      .from("catalog_projects")
      .select("id, org_id, payload, draft_payload")
      .eq("id", projectId)
      .maybeSingle();
    if (!row || row.org_id !== prof.org_id) return { ok: false, error: "Проект не найден" };

    const existing = catalogProjectSchema.parse(row.draft_payload ?? row.payload);

    // Editorial fields stay as they are.
    const f = new FormData();
    for (const [k, v] of fd.entries()) f.append(k, v);
    f.set("rat", String(existing.rat));
    f.set("risk", String(existing.risk));
    f.set("rec", existing.rec);
    f.set("recText", existing.recText);
    const parsed = parseStudioForm(f);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const regionId = String(fd.get("region_id") ?? "");
    let zone = existing.zone;
    if (regionId) {
      const { data: reg } = await db.from("regions").select("name").eq("id", regionId).maybeSingle();
      const en = (reg?.name as { en?: string } | undefined)?.en;
      if (!en) return { ok: false, error: "Выберите район из списка" };
      zone = en;
    }

    let merged;
    try {
      merged = mergeStudioFields(existing, parsed.fields, { dev: existing.dev, dt: existing.dt, zone });
    } catch (e) {
      return { ok: false, error: `Проверьте поля: ${e instanceof Error ? e.message : "ошибка"}` };
    }

    const { error } = await db
      .from("catalog_projects")
      .update({ draft_payload: merged, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/partner/projects");
    revalidatePath(`/partner/projects/${projectId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка" };
  }
}
