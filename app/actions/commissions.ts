"use server";

import { revalidatePath } from "next/cache";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { buildPlanPayload, loadTerms, planAndStoreDeal } from "@/lib/commission/service";
import { commissionTermsSchema, platformFeeSchema } from "@/lib/commission/terms";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export type CommState = {
  ok: boolean;
  error?: string;
  message?: string;
  id?: string;
  preview?: {
    currency: string;
    basisPrice: number;
    gross: number;
    platformFeeTotal: number;
    referralTotal: number;
    brokerNet: number;
    entries: { milestone: string; kind: string; payer: string; payee: string; amount: number; delayDays: number }[];
  };
};

async function requireAdmin() {
  if (!(await getAdminSessionOk())) throw new Error("Нужен вход в панель");
  if (!hasSupabaseServiceConfig()) throw new Error("Supabase service role не настроен");
  return createServiceRoleClient();
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string): number | undefined => {
  const v = s(fd, k).replace(/\s/g, "").replace(",", ".");
  if (v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};
const uuidOrNull = (v: string) => (v === "" ? null : v);

function fail(e: unknown): CommState {
  return { ok: false, error: e instanceof Error ? e.message : "Ошибка" };
}

/** Friendly Russian text for rule violations raised by the database functions. */
function dbMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("plan the commission")) return "Сначала рассчитайте комиссию (нужно действующее соглашение).";
  if (m.includes("backwards") || m.includes("repeat")) return "Сделку нельзя вернуть назад или повторить статус.";
  if (m.includes("already closed") || m.includes("deal is closed")) return "Сделка уже закрыта.";
  if (m.includes("payments already recorded")) return "По сделке уже есть платежи: пересчитывать нельзя, используйте корректировку.";
  if (m.includes("exceeds the amount due")) return "Платёж превышает сумму к оплате.";
  if (m.includes("only due entries")) return "Платить можно только начисления в статусе «к оплате».";
  if (m.includes("a note is required")) return "Укажите причину (не менее 5 символов).";
  return msg;
}

// ---------------------------------------------------------------- organisations
export async function adminCreateOrg(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const name_ru = s(fd, "name_ru");
    const name_en = s(fd, "name_en") || name_ru;
    const kind = s(fd, "kind");
    if (!name_ru) return { ok: false, error: "Укажите название" };
    if (!["developer", "broker", "registry_operator"].includes(kind)) return { ok: false, error: "Некорректный тип" };
    const slug = (s(fd, "slug") || name_en).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    if (!slug) return { ok: false, error: "Укажите slug латиницей" };
    const { error } = await db.from("orgs").insert({ slug, name_ru, name_en, kind, org_moderation_status: "published" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/commissions");
    return { ok: true, message: "Организация создана" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- agreements
export async function adminSaveAgreement(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const model = s(fd, "model");
    let tiers: unknown;
    if (model === "tiered") {
      try {
        tiers = JSON.parse(s(fd, "tiers_json") || "[]");
      } catch {
        return { ok: false, error: "Ступени: некорректный JSON" };
      }
    }
    const ev = (event: "reserved" | "contract_signed" | "won", p: string, d: string) => {
      const percent = n(fd, p) ?? 0;
      return percent > 0 ? [{ event, percent, delayDays: Math.round(n(fd, d) ?? 0) }] : [];
    };
    const parsed = commissionTermsSchema.safeParse({
      model,
      percent: n(fd, "percent"),
      fixed: n(fd, "fixed"),
      tiers,
      tierMode: s(fd, "tier_mode") || "marginal",
      min: n(fd, "min") ?? null,
      max: n(fd, "max") ?? null,
      basis: s(fd, "basis") || "contract_price",
      currency: (s(fd, "currency") || "THB").toUpperCase(),
      schedule: [...ev("reserved", "sch_reserved", "dly_reserved"), ...ev("contract_signed", "sch_contract", "dly_contract"), ...ev("won", "sch_won", "dly_won")],
      payoutMode: s(fd, "payout_mode") || "direct",
      vatPercent: n(fd, "vat_percent") ?? 0,
      clawbackDays: Math.round(n(fd, "clawback_days") ?? 0),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };

    const developer_org_id = s(fd, "developer_org_id");
    if (!developer_org_id) return { ok: false, error: "Выберите застройщика" };
    const row = {
      name: s(fd, "name").slice(0, 200),
      developer_org_id,
      broker_org_id: uuidOrNull(s(fd, "broker_org_id")),
      project_id: uuidOrNull(s(fd, "project_id")),
      terms: parsed.data,
      exclusive: fd.get("exclusive") === "on",
      visibility: s(fd, "visibility") === "public_to_brokers" ? "public_to_brokers" : "parties",
      status: ["draft", "active", "archived"].includes(s(fd, "status")) ? s(fd, "status") : "draft",
      valid_from: s(fd, "valid_from") || new Date().toISOString().slice(0, 10),
      valid_to: uuidOrNull(s(fd, "valid_to")),
      note: s(fd, "note").slice(0, 1000),
      updated_at: new Date().toISOString(),
    };
    const id = s(fd, "id");
    const { error } = id ? await db.from("commission_agreements").update(row).eq("id", id) : await db.from("commission_agreements").insert(row);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/commissions");
    return { ok: true, message: id ? "Соглашение обновлено" : "Соглашение создано" };
  } catch (e) {
    return fail(e);
  }
}

export async function adminSetAgreementStatus(id: string, status: "draft" | "active" | "archived"): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const { error } = await db.from("commission_agreements").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/commissions");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- broker terms
export async function adminSaveBrokerTerms(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const fee = platformFeeSchema.safeParse({
      type: s(fd, "fee_type") || "none",
      percent: n(fd, "fee_percent"),
      fixed: n(fd, "fee_fixed"),
      referralDefaultPercent: n(fd, "referral_default") ?? 0,
    });
    if (!fee.success) return { ok: false, error: fee.error.issues.map((i) => i.message).join("; ") };
    const broker_org_id = s(fd, "broker_org_id");
    if (!broker_org_id) return { ok: false, error: "Выберите брокера" };
    const row = {
      broker_org_id,
      developer_org_id: uuidOrNull(s(fd, "developer_org_id")),
      platform_fee: fee.data,
      status: ["draft", "active", "archived"].includes(s(fd, "status")) ? s(fd, "status") : "active",
      valid_from: s(fd, "valid_from") || new Date().toISOString().slice(0, 10),
      valid_to: uuidOrNull(s(fd, "valid_to")),
      note: s(fd, "note").slice(0, 1000),
    };
    const id = s(fd, "id");
    const { error } = id ? await db.from("broker_terms").update(row).eq("id", id) : await db.from("broker_terms").insert(row);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/commissions");
    return { ok: true, message: "Условия брокера сохранены" };
  } catch (e) {
    return fail(e);
  }
}

export async function adminSaveLeadRouting(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const v = { default_broker_org_id: uuidOrNull(s(fd, "default_broker_org_id")) };
    const { error } = await db.from("platform_settings").upsert({ key: "lead_routing", value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/commissions");
    return { ok: true, message: "Маршрутизация лидов сохранена" };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- preview calculator
export async function adminPreviewCommission(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const developer = s(fd, "developer_org_id");
    const broker = s(fd, "broker_org_id");
    const price = n(fd, "price");
    if (!developer || !broker || price === undefined) return { ok: false, error: "Укажите застройщика, брокера и цену" };
    const { agreements, brokerTerms, defaultPlatformFee } = await loadTerms(db, developer, broker);
    const referrer = uuidOrNull(s(fd, "referrer_org_id"));
    const out = buildPlanPayload(
      {
        dealId: "preview",
        developerOrgId: developer,
        brokerOrgId: broker,
        referrerOrgId: referrer,
        referralPercent: n(fd, "referral_percent") ?? null,
        projectId: uuidOrNull(s(fd, "project_id")),
        contractPrice: price,
        netPrice: n(fd, "net_price") ?? null,
        priceCurrency: (s(fd, "price_currency") || "THB").toUpperCase(),
        fxRate: n(fd, "fx_rate") ?? null,
        date: new Date().toISOString().slice(0, 10),
      },
      agreements,
      brokerTerms,
      defaultPlatformFee,
    );
    if (!out.ok) return { ok: false, error: out.message };
    const { data: orgs } = await db.from("orgs").select("id, name_ru");
    const name = new Map((orgs ?? []).map((o) => [o.id as string, o.name_ru as string]));
    const label = (id: string | null) => (id ? name.get(id) ?? id.slice(0, 8) : "Платформа");
    return {
      ok: true,
      preview: {
        currency: out.plan.currency,
        basisPrice: out.plan.basisPrice,
        gross: out.plan.gross,
        platformFeeTotal: out.plan.platformFeeTotal,
        referralTotal: out.plan.referralTotal,
        brokerNet: out.plan.brokerNet,
        entries: out.plan.entries.map((e) => ({ milestone: e.milestone, kind: e.kind, payer: label(e.payerOrg), payee: label(e.payeeOrg), amount: e.amount, delayDays: e.delayDays })),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- deals
export async function adminCreateDeal(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const projectId = s(fd, "project_id");
    const broker = s(fd, "broker_org_id");
    const price = n(fd, "contract_price");
    if (!projectId || !broker || price === undefined || price < 0) return { ok: false, error: "Укажите проект, брокера и цену договора" };
    const { data: proj } = await db.from("catalog_projects").select("id, org_id").eq("id", projectId).maybeSingle();
    if (!proj?.org_id) return { ok: false, error: "У проекта не задан застройщик (организация). Привяжите проект к организации." };

    const row = {
      project_id: projectId,
      developer_org_id: proj.org_id as string,
      broker_org_id: broker,
      referrer_org_id: uuidOrNull(s(fd, "referrer_org_id")),
      referral_percent: n(fd, "referral_percent") ?? null,
      contract_price: price,
      net_price: n(fd, "net_price") ?? null,
      price_currency: (s(fd, "price_currency") || "THB").toUpperCase(),
      fx_rate: n(fd, "fx_rate") ?? null,
      lead_id: uuidOrNull(s(fd, "lead_id")),
      unit_id: uuidOrNull(s(fd, "unit_id")),
      notes: s(fd, "notes").slice(0, 2000),
      status: "open",
    };
    const { data: ins, error } = await db.from("deals").insert(row).select("id").single();
    if (error) return { ok: false, error: error.message };
    const id = ins.id as string;
    if (row.lead_id) await db.from("leads").update({ deal_id: id }).eq("id", row.lead_id);
    await db.from("deal_events").insert({ deal_id: id, event: "created", note: "Сделка создана", actor: null });

    const planned = await planAndStoreDeal(db, id);
    revalidatePath("/admin/deals");
    return planned.ok
      ? { ok: true, id, message: "Сделка создана, комиссия рассчитана" }
      : { ok: true, id, message: `Сделка создана, но комиссия не рассчитана: ${planned.message}` };
  } catch (e) {
    return fail(e);
  }
}

export async function adminReplanDeal(dealId: string): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const r = await planAndStoreDeal(db, dealId);
    revalidatePath(`/admin/deals/${dealId}`);
    return r.ok ? { ok: true, message: "Комиссия пересчитана по действующим условиям" } : { ok: false, error: dbMessage(r.message ?? "Ошибка") };
  } catch (e) {
    return fail(e);
  }
}

export async function adminAdvanceDeal(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const dealId = s(fd, "deal_id");
    const { error } = await db.rpc("advance_deal", { p_deal: dealId, p_status: s(fd, "status"), p_note: s(fd, "note") });
    if (error) return { ok: false, error: dbMessage(error.message) };
    revalidatePath(`/admin/deals/${dealId}`);
    revalidatePath("/admin/deals");
    return { ok: true, message: "Статус обновлён" };
  } catch (e) {
    return fail(e);
  }
}

export async function adminRecordPayment(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const amount = n(fd, "amount");
    if (amount === undefined) return { ok: false, error: "Укажите сумму" };
    const { error } = await db.rpc("record_ledger_payment", {
      p_entry: s(fd, "entry_id"),
      p_amount: amount,
      p_ref: s(fd, "reference").slice(0, 200),
      p_paid_at: s(fd, "paid_at") ? new Date(s(fd, "paid_at")).toISOString() : new Date().toISOString(),
    });
    if (error) return { ok: false, error: dbMessage(error.message) };
    revalidatePath(`/admin/deals/${s(fd, "deal_id")}`);
    return { ok: true, message: "Платёж записан" };
  } catch (e) {
    return fail(e);
  }
}

export async function adminAddAdjustment(_p: CommState, fd: FormData): Promise<CommState> {
  try {
    const db = await requireAdmin();
    const amount = n(fd, "amount");
    if (amount === undefined || amount <= 0) return { ok: false, error: "Укажите сумму больше нуля" };
    const { error } = await db.rpc("add_ledger_adjustment", {
      p_deal: s(fd, "deal_id"),
      p_kind: s(fd, "kind") === "clawback" ? "clawback" : "adjustment",
      p_payer: uuidOrNull(s(fd, "payer_org")),
      p_payee: uuidOrNull(s(fd, "payee_org")),
      p_amount: amount,
      p_currency: (s(fd, "currency") || "THB").toUpperCase(),
      p_note: s(fd, "note"),
    });
    if (error) return { ok: false, error: dbMessage(error.message) };
    revalidatePath(`/admin/deals/${s(fd, "deal_id")}`);
    return { ok: true, message: "Корректировка добавлена" };
  } catch (e) {
    return fail(e);
  }
}
