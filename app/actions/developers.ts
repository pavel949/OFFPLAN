"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { inviteSchema, orgSlug } from "@/lib/developer-invite";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";

export type InviteState = { ok: boolean; error?: string; message?: string };

/**
 * Onboard a developer: create the organisation, invite the owner by e-mail, link the profile.
 * The invited person sets their own password via the e-mail link; no password is ever handled here.
 */
export async function inviteDeveloper(_: InviteState, f: FormData): Promise<InviteState> {
  if (!(await getAdminSessionOk())) return { ok: false, error: "Нужен вход в панель IE" };
  if (!hasSupabaseServiceConfig())
    return { ok: false, error: "Не задан SUPABASE_SERVICE_ROLE_KEY" };

  const parsed = inviteSchema.safeParse({
    name_ru: f.get("name_ru") ?? "",
    name_en: f.get("name_en") ?? "",
    email: f.get("email") ?? "",
    full_name: f.get("full_name") ?? "",
    website: f.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
  const v = parsed.data;

  const db = createServiceRoleClient();
  const { data: org, error: orgErr } = await db
    .from("orgs")
    .insert({
      slug: orgSlug(v.name_en || v.name_ru, randomUUID().slice(0, 6)),
      name_ru: v.name_ru,
      name_en: v.name_en || v.name_ru,
      kind: "developer",
      website: v.website || null,
    })
    .select("id")
    .single();
  if (orgErr || !org) return { ok: false, error: "Не удалось создать организацию: " + (orgErr?.message ?? "") };

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const { data: invited, error: invErr } = await db.auth.admin.inviteUserByEmail(v.email, {
    ...(site ? { redirectTo: `${site}/partner` } : {}),
    data: { full_name: v.full_name },
  });
  if (invErr || !invited?.user) {
    // do not leave an empty organisation behind
    await db.from("orgs").delete().eq("id", org.id);
    return {
      ok: false,
      error:
        "Не удалось отправить приглашение: " +
        (invErr?.message ?? "неизвестная ошибка") +
        " (если пользователь с таким e-mail уже есть, привяжите его вручную)",
    };
  }

  const { error: profErr } = await db.from("profiles").upsert(
    {
      id: invited.user.id,
      role: "partner",
      org_id: org.id,
      partner_role: "owner",
      full_name: v.full_name || null,
    },
    { onConflict: "id" },
  );
  if (profErr)
    return {
      ok: false,
      error: "Приглашение отправлено, но профиль не привязан: " + profErr.message,
    };

  revalidatePath("/admin/developers");
  return { ok: true, message: `Приглашение отправлено на ${v.email}. Организация создана.` };
}
