"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { partnerLeadCommand } from "@/lib/leads/partner";

export async function updatePartnerLead(_previous: { ok: boolean; error?: string }, form: FormData) {
  const parsed = partnerLeadCommand.safeParse({ leadId: form.get("lead_id"), action: form.get("action"), status: form.get("status") || undefined });
  if (!parsed.success) return { ok: false, error: "Проверьте действие и статус заявки." };
  const db = await createSupabaseServerClient();
  if (!db || !(await db.auth.getUser()).data.user) return { ok: false, error: "Войдите в кабинет." };
  const { error } = await db.rpc("partner_update_lead", { p_lead_id: parsed.data.leadId, p_action: parsed.data.action, p_status: parsed.data.status ?? null });
  if (error) return { ok: false, error: "Не удалось обновить заявку. Обновите страницу и проверьте ответственного." };
  revalidatePath("/partner/leads");
  revalidatePath("/partner/analytics");
  return { ok: true };
}
