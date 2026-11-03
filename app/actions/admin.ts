"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { catalogProjectsSchema } from "@/lib/schema";
import { projectSlug } from "@/lib/slug";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

/**
 * Bulk import of catalogue rows (admin session required).
 * Validates against the strict schema, then upserts into catalog_projects by legacy_id.
 * Admin is a trusted publisher (same as adminSaveProjectPayload): new ids are inserted as
 * published, existing ids get their payload replaced.
 */
export async function importProjectsJson(
  _prev: { ok: boolean; error?: string; imported?: number },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; imported?: number }> {
  if (!(await getAdminSessionOk())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceConfig()) {
    return { ok: false, error: "Supabase service role не настроен" };
  }
  const payload = String(formData.get("payload") ?? "");
  let rows;
  try {
    rows = catalogProjectsSchema.parse(JSON.parse(payload));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const ids = rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Дубликаты id в импорте" };
  }

  const db = createServiceRoleClient();
  const { data: existing, error: exErr } = await db
    .from("catalog_projects")
    .select("legacy_id")
    .in("legacy_id", ids);
  if (exErr) return { ok: false, error: exErr.message };
  const existingIds = new Set((existing ?? []).map((r) => r.legacy_id as number));

  const now = new Date().toISOString();
  let imported = 0;
  for (const p of rows) {
    if (existingIds.has(p.id)) {
      const { error } = await db
        .from("catalog_projects")
        .update({ payload: p, updated_at: now })
        .eq("legacy_id", p.id);
      if (error) return { ok: false, error: `id ${p.id}: ${error.message}`, imported };
    } else {
      const { error } = await db.from("catalog_projects").insert({
        legacy_id: p.id,
        slug: projectSlug(p),
        payload: p,
        moderation_status: "published",
        is_published: true,
      });
      if (error) return { ok: false, error: `id ${p.id}: ${error.message}`, imported };
    }
    imported += 1;
  }
  revalidatePath("/admin/projects");
  return { ok: true, imported };
}
