"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { emptySalesModel, salesModelSchema } from "@/lib/sales-model";
import { partnerSalesView, preparePartnerSales } from "@/lib/partner-sales";

async function context(projectId: string) {
  z.uuid().parse(projectId);
  const session = await createSupabaseServerClient();
  if (!session) throw new Error("Кабинет временно недоступен");
  const { data: { user }, error: authError } = await session.auth.getUser();
  if (authError || !user) throw new Error("Войдите в кабинет");
  const profile = await session.from("profiles").select("org_id,role,partner_role").eq("id", user.id).maybeSingle();
  if (profile.error || profile.data?.role !== "partner" || profile.data.partner_role !== "owner" || !profile.data.org_id) throw new Error("Условия продажи может отправить владелец организации");
  const project = await session.from("catalog_projects").select("id,org_id,jurisdiction_code").eq("id", projectId).eq("org_id", profile.data.org_id).maybeSingle();
  if (project.error || !project.data || project.data.org_id !== profile.data.org_id) throw new Error("Проект недоступен");
  // No privileged client is created before authenticated ownership is proven.
  return { db: createServiceRoleClient(), project: project.data, userId: user.id };
}

async function snapshot(ctx: Awaited<ReturnType<typeof context>>, projectId: string) {
  const { db } = ctx;
  const [latest, publication] = await Promise.all([
    db.from("project_sales_models").select("revision,model,actor").eq("project_id", projectId).order("revision", { ascending: false }).limit(1).maybeSingle(),
    db.from("project_sales_publications").select("revision,expires_at").eq("project_id", projectId).maybeSingle(),
  ]);
  if (latest.error || publication.error) throw new Error("Не удалось прочитать версии условий. Повторите позже.");
  const model = latest.data ? salesModelSchema.parse(latest.data.model) : emptySalesModel();
  if (!latest.data) {
    model.countryCode = ctx.project.jurisdiction_code ?? "";
    const currency = await db.from("jurisdictions").select("currency").eq("code", model.countryCode).maybeSingle();
    if (currency.error) throw new Error("Не удалось определить валюту проекта");
    if (currency.data?.currency) model.defaultCurrency = currency.data.currency;
  }
  const units: { id: string; label: string; status: string; bedrooms: number | null }[] = [];
  for (let start = 0; ; start += 500) {
    const result = await db.from("project_units").select("id,label,status,bedrooms").eq("project_id", projectId).order("id").range(start, start + 499);
    if (result.error) throw new Error("Не удалось прочитать юниты");
    units.push(...result.data);
    if (result.data.length < 500) break;
  }
  return { model, revision: latest.data?.revision ?? 0, publication: publication.data, units };
}

export async function partnerGetSalesModel(projectId: string) {
  const ctx = await context(projectId);
  const data = await snapshot(ctx, projectId);
  return { ...data, model: partnerSalesView(data.model) };
}

export async function partnerSaveSalesModel(projectId: string, revision: number, input: unknown) {
  try {
    z.number().int().nonnegative().parse(revision);
    if (JSON.stringify(input).length > 2_000_000) return { ok: false, error: "Модель слишком велика" };
    const ctx = await context(projectId);
    const current = await snapshot(ctx, projectId);
    if (revision !== current.revision) return { ok: false, error: "Другой сотрудник сохранил новую версию. Обновите страницу. Несохранённые изменения остаются в форме." };
    const model = preparePartnerSales(input, current.model);
    const ids = new Set(current.units.map(u => u.id));
    if (model.units.some(u => !ids.has(u.id))) return { ok: false, error: "Юнит не принадлежит этому проекту или удалён" };
    // Ownership is rechecked before the write; DB trigger serializes revision/unit identity checks.
    const checked = await context(projectId);
    if (checked.project.org_id !== ctx.project.org_id || checked.userId !== ctx.userId) throw new Error("Доступ к проекту изменился");
    const { error } = await checked.db.from("project_sales_models").insert({ project_id: projectId, revision: revision + 1, model, actor: `partner:${ctx.userId}` });
    if (error) {
      if (error.code === "23505" || error.message.includes("revision conflict")) return { ok: false, error: "Версия уже изменилась. Обновите страницу; изменения остались в форме." };
      throw new Error("Не удалось сохранить условия на проверку");
    }
    revalidatePath(`/partner/projects/${projectId}/inventory`);
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath("/admin/moderation");
    return { ok: true, revision: revision + 1 };
  } catch (error) {
    return { ok: false, error: error instanceof z.ZodError ? "Проверьте обязательные поля, даты и ссылки на юниты" : error instanceof Error ? error.message : "Не удалось сохранить условия" };
  }
}

export async function partnerCreateSalesUnit(projectId: string, label: string) {
  try {
    const ctx = await context(projectId);
    const name = z.string().trim().min(1).max(80).parse(label);
    // Physical identity only: no inferred availability, price or confirmation timestamp.
    const { data, error } = await ctx.db.from("project_units").insert({ project_id: projectId, label: name, status: "unknown", source: "developer", price_thb: null, price_updated_at: null }).select("id").single();
    if (error) throw new Error("Не удалось создать юнит");
    revalidatePath(`/partner/projects/${projectId}/inventory`);
    return { ok: true, id: data.id };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Не удалось создать юнит" }; }
}
