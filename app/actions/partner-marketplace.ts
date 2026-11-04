"use server";

import { revalidatePath } from "next/cache";
import { runUnitImport, type ImportState } from "@/lib/inventory/run";
import { insertCatalogAuditLog } from "@/lib/marketplace/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PartnerCtx = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
  user: { id: string };
  projectId: string;
  partnerRole: string | null;
};

async function getPartnerProjectContext(
  projectId: string,
): Promise<{ ok: true; ctx: PartnerCtx } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Нет Supabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Войдите" };
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role, partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") {
    return { ok: false, error: "Нужна роль partner" };
  }
  const { data: row } = await supabase
    .from("catalog_projects")
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!row || row.org_id !== prof.org_id) {
    return { ok: false, error: "Проект не найден" };
  }
  return {
    ok: true,
    ctx: {
      supabase,
      user: { id: user.id },
      projectId,
      partnerRole: prof.partner_role ?? null,
    },
  };
}

export async function confirmProjectData(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  if (!projectId) return { ok: false, error: "Нет project_id" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  const now = new Date().toISOString();
  // Refresh "price is current" for all active units (no data change), then stamp the project.
  const { error: rpcErr } = await r.ctx.supabase.rpc("confirm_project_prices", {
    p_project_id: projectId,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  const { error } = await r.ctx.supabase
    .from("catalog_projects")
    .update({ data_confirmed_at: now, updated_at: now })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  void insertCatalogAuditLog({
    entity_type: "project",
    entity_id: projectId,
    actor_id: r.ctx.user.id,
    action: "data_confirmed",
    diff: { data_confirmed_at: now },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function saveProjectUpdate(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "news");
  const title_ru = String(formData.get("title_ru") ?? "").trim();
  const body_ru = String(formData.get("body_ru") ?? "").trim();
  // The cabinet is Russian-first: the English fields default to the Russian text until a translation exists.
  const title_en = String(formData.get("title_en") ?? "").trim() || title_ru;
  const body_en = String(formData.get("body_en") ?? "").trim() || body_ru;
  if (!projectId) return { ok: false, error: "Не выбран проект" };
  if (!title_ru) return { ok: false, error: "Укажите заголовок" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  const k = ["news", "construction", "milestone"].includes(kind) ? kind : "news";
  const { data: inserted, error } = await r.ctx.supabase
    .from("project_updates")
    .insert({
      project_id: projectId,
      kind: k,
      title_en,
      title_ru,
      body_en,
      body_ru,
      created_by: r.ctx.user.id,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (inserted?.id) {
    void insertCatalogAuditLog({
      entity_type: "update",
      entity_id: inserted.id as string,
      actor_id: r.ctx.user.id,
      action: "project_update_created",
      diff: { kind: k, project_id: projectId },
    });
  }
  revalidatePath("/");
  return { ok: true };
}

function validateUnitRow(row: {
  label: string;
  bedrooms: number | null;
  sqm: number | null;
  price_thb: number | null;
  status: string;
}): { ok: true } | { ok: false; error: string } {
  if (row.sqm != null && (Number.isNaN(row.sqm) || row.sqm <= 0)) {
    return { ok: false, error: "sqm должно быть положительным числом" };
  }
  if (row.price_thb != null && (Number.isNaN(row.price_thb) || row.price_thb < 0)) {
    return { ok: false, error: "Цена не может быть отрицательной" };
  }
  if (row.status === "available" && (row.price_thb == null || row.price_thb <= 0)) {
    return {
      ok: false,
      error: "Для статуса «available» укажите цену (THB) больше 0",
    };
  }
  return { ok: true };
}

export async function upsertProjectUnit(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const unitId = String(formData.get("unit_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  if (!projectId || !label) return { ok: false, error: "project_id и label обязательны" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  const bedrooms = formData.get("bedrooms");
  const sqm = formData.get("sqm");
  const price = formData.get("price_thb");
  const status = String(formData.get("status") ?? "available");
  const row = {
    label,
    bedrooms:
      typeof bedrooms === "string" && bedrooms.trim() !== ""
        ? Number(bedrooms)
        : null,
    sqm: typeof sqm === "string" && sqm.trim() !== "" ? Number(sqm) : null,
    price_thb:
      typeof price === "string" && price.trim() !== "" ? Number(price) : null,
    status: ["available", "reserved", "sold"].includes(status)
      ? status
      : "available",
    updated_at: new Date().toISOString(),
  };
  const v = validateUnitRow(row);
  if (!v.ok) return { ok: false, error: v.error };
  if (unitId) {
    const { error } = await r.ctx.supabase
      .from("project_units")
      .update(row)
      .eq("id", unitId)
      .eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    void insertCatalogAuditLog({
      entity_type: "unit",
      entity_id: unitId,
      actor_id: r.ctx.user.id,
      action: "unit_updated",
      diff: { label: row.label, status: row.status },
    });
  } else {
    const { data: ins, error } = await r.ctx.supabase
      .from("project_units")
      .insert({
        ...row,
        project_id: projectId,
      })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (ins?.id) {
      void insertCatalogAuditLog({
        entity_type: "unit",
        entity_id: ins.id as string,
        actor_id: r.ctx.user.id,
        action: "unit_created",
        diff: { label: row.label },
      });
    }
  }
  revalidatePath("/");
  return { ok: true };
}

export async function upsertSalesCampaign(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "launch");
  const label_en = String(formData.get("label_en") ?? "").trim();
  const label_ru = String(formData.get("label_ru") ?? "").trim();
  const startsRaw = String(formData.get("starts_at") ?? "").trim();
  const endsRaw = String(formData.get("ends_at") ?? "").trim();
  if (!projectId) return { ok: false, error: "Нет project_id" };
  if (!label_en && !label_ru) return { ok: false, error: "Подпись EN или RU" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.ctx.partnerRole === "sales") {
    return {
      ok: false,
      error: "Кампании создаёт владелец организации (owner).",
    };
  }
  const k = ["launch", "sale", "other"].includes(kind) ? kind : "launch";
  const starts_at =
    startsRaw === "" ? null : new Date(startsRaw).toISOString();
  const ends_at = endsRaw === "" ? null : new Date(endsRaw).toISOString();
  const payload = {
    project_id: projectId,
    kind: k,
    label_en,
    label_ru,
    starts_at,
    ends_at,
  };
  if (campaignId) {
    const { error } = await r.ctx.supabase
      .from("sales_campaigns")
      .update(payload)
      .eq("id", campaignId)
      .eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    void insertCatalogAuditLog({
      entity_type: "campaign",
      entity_id: campaignId,
      actor_id: r.ctx.user.id,
      action: "campaign_updated",
      diff: { kind: k },
    });
  } else {
    const { data: ins, error } = await r.ctx.supabase
      .from("sales_campaigns")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (ins?.id) {
      void insertCatalogAuditLog({
        entity_type: "campaign",
        entity_id: ins.id as string,
        actor_id: r.ctx.user.id,
        action: "campaign_created",
        diff: { kind: k },
      });
    }
  }
  revalidatePath("/");
  revalidatePath(`/partner/projects/${projectId}/campaigns`);
  return { ok: true };
}

export async function deleteSalesCampaign(
  _prev: { ok: boolean; error?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!projectId || !campaignId) return { ok: false, error: "Нет id" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  if (r.ctx.partnerRole === "sales") {
    return { ok: false, error: "Удаление кампаний — только owner." };
  }
  const { error } = await r.ctx.supabase
    .from("sales_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  void insertCatalogAuditLog({
    entity_type: "campaign",
    entity_id: campaignId,
    actor_id: r.ctx.user.id,
    action: "campaign_deleted",
    diff: null,
  });
  revalidatePath("/");
  revalidatePath(`/partner/projects/${projectId}/campaigns`);
  return { ok: true };
}

/** Bulk price list / inventory import (preview → apply). Owner and sales roles may import. */
export async function importProjectUnits(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const projectId = String(formData.get("project_id") ?? "").trim();
  const text = String(formData.get("text") ?? "");
  const mode = formData.get("mode") === "apply" ? "apply" : "preview";
  if (!projectId) return { ok: false, error: "Нет project_id" };
  const r = await getPartnerProjectContext(projectId);
  if (!r.ok) return { ok: false, error: r.error };
  const res = await runUnitImport({
    db: r.ctx.supabase,
    projectId,
    text,
    mode,
    source: "import",
    actorId: r.ctx.user.id,
  });
  if (res.ok && res.mode === "apply") {
    void insertCatalogAuditLog({
      entity_type: "unit",
      entity_id: projectId,
      actor_id: r.ctx.user.id,
      action: "units_imported",
      diff: { ...res.applied, summary: res.summary },
    });
    revalidatePath("/");
    revalidatePath(`/partner/projects/${projectId}/inventory`);
  }
  return res;
}
