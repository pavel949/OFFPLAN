import type { SupabaseClient } from "@supabase/supabase-js";
import {
  planDeal,
  resolveAgreement,
  resolveBrokerTerms,
  type AgreementLike,
  type BrokerTermsLike,
  type DealPlan,
} from "./engine";
import {
  commissionTermsSchema,
  platformFeeSchema,
  type CommissionTerms,
  type PlatformFee,
} from "./terms";

export interface AgreementRow extends AgreementLike {
  terms: unknown;
  exclusive: boolean;
  name: string;
}
export interface BrokerTermsRow extends BrokerTermsLike {
  platformFee: unknown;
}

export interface DealInputs {
  dealId: string;
  developerOrgId: string;
  brokerOrgId: string;
  referrerOrgId: string | null;
  referralPercent: number | null;
  projectId: string | null;
  contractPrice: number;
  netPrice: number | null;
  priceCurrency: string;
  fxRate: number | null;
  /** YYYY-MM-DD */
  date: string;
}

/** Shape of the JSON accepted by the SQL function set_deal_plan(). */
export interface PlanPayload {
  totals: { currency: string; gross: number; platform_fee_total: number; referral_total: number; broker_net: number };
  snapshot: Record<string, unknown>;
  entries: {
    milestone: string;
    kind: string;
    payer_org: string | null;
    payee_org: string | null;
    amount: number;
    currency: string;
    delay_days: number;
  }[];
}

export type PlanOutcome =
  | { ok: true; payload: PlanPayload; plan: DealPlan; agreementId: string; brokerTermsId: string | null }
  | { ok: false; reason: "no_agreement" | "invalid_terms" | "calc_error"; message: string };

export function buildPlanPayload(
  i: DealInputs,
  agreements: AgreementRow[],
  brokerTerms: BrokerTermsRow[],
  defaultPlatformFee: PlatformFee | null = null,
): PlanOutcome {
  const ag = resolveAgreement(agreements, {
    developerOrgId: i.developerOrgId,
    brokerOrgId: i.brokerOrgId,
    projectId: i.projectId,
    date: i.date,
  });
  if (!ag) {
    return { ok: false, reason: "no_agreement", message: "Нет действующего соглашения о комиссии для этого застройщика, брокера и даты. Создайте или активируйте соглашение." };
  }
  const t = commissionTermsSchema.safeParse(ag.terms);
  if (!t.success) {
    return { ok: false, reason: "invalid_terms", message: `Условия соглашения «${ag.name || ag.id}» некорректны: ${t.error.issues[0]?.message}` };
  }
  const bt = resolveBrokerTerms(brokerTerms, i.brokerOrgId, i.developerOrgId, i.date);
  let fee: PlatformFee | null = defaultPlatformFee;
  if (bt) {
    const f = platformFeeSchema.safeParse(bt.platformFee);
    if (!f.success) return { ok: false, reason: "invalid_terms", message: `Условия брокера с платформой некорректны: ${f.error.issues[0]?.message}` };
    fee = f.data;
  }
  const referralPercent = i.referrerOrgId ? (i.referralPercent ?? fee?.referralDefaultPercent ?? 0) : null;

  let plan: DealPlan;
  try {
    plan = planDeal({
      terms: t.data as CommissionTerms,
      platformFee: fee,
      price: i.contractPrice,
      netPrice: i.netPrice,
      priceCurrency: i.priceCurrency,
      fxRate: i.fxRate,
      developerOrgId: i.developerOrgId,
      brokerOrgId: i.brokerOrgId,
      referrerOrgId: i.referrerOrgId,
      referralPercent,
    });
  } catch (e) {
    return { ok: false, reason: "calc_error", message: e instanceof Error ? e.message : "Ошибка расчёта" };
  }

  const payload: PlanPayload = {
    totals: {
      currency: plan.currency,
      gross: plan.gross,
      platform_fee_total: plan.platformFeeTotal,
      referral_total: plan.referralTotal,
      broker_net: plan.brokerNet,
    },
    snapshot: {
      agreement_id: ag.id,
      broker_terms_id: bt?.id ?? null,
      terms: t.data,
      platform_fee: fee,
      referral_percent: referralPercent,
      basis_price: plan.basisPrice,
      price: i.contractPrice,
      price_currency: i.priceCurrency,
      fx_rate: i.fxRate,
      planned_at: new Date().toISOString(),
      summary: `Комиссия ${plan.gross} ${plan.currency}; платформа ${plan.platformFeeTotal}; реферал ${plan.referralTotal}; брокеру ${plan.brokerNet}`,
    },
    entries: plan.entries.map((e) => ({
      milestone: e.milestone,
      kind: e.kind,
      payer_org: e.payerOrg,
      payee_org: e.payeeOrg,
      amount: e.amount,
      currency: e.currency,
      delay_days: e.delayDays,
    })),
  };
  return { ok: true, payload, plan, agreementId: ag.id, brokerTermsId: bt?.id ?? null };
}

// ---------------------------------------------------------------------------
// Database access (service-role client; admin actions only)
// ---------------------------------------------------------------------------
export async function loadTerms(db: SupabaseClient, developerOrgId: string, brokerOrgId: string) {
  const [a, b, s] = await Promise.all([
    db.from("commission_agreements").select("id, name, developer_org_id, broker_org_id, project_id, terms, exclusive, status, valid_from, valid_to").eq("developer_org_id", developerOrgId),
    db.from("broker_terms").select("id, broker_org_id, developer_org_id, platform_fee, status, valid_from, valid_to").eq("broker_org_id", brokerOrgId),
    db.from("platform_settings").select("value").eq("key", "default_platform_fee").maybeSingle(),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  const agreements: AgreementRow[] = (a.data ?? []).map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "",
    developerOrgId: r.developer_org_id as string,
    brokerOrgId: (r.broker_org_id as string) ?? null,
    projectId: (r.project_id as string) ?? null,
    terms: r.terms,
    exclusive: !!r.exclusive,
    status: r.status as string,
    validFrom: r.valid_from as string,
    validTo: (r.valid_to as string) ?? null,
  }));
  const brokerTerms: BrokerTermsRow[] = (b.data ?? []).map((r) => ({
    id: r.id as string,
    brokerOrgId: r.broker_org_id as string,
    developerOrgId: (r.developer_org_id as string) ?? null,
    platformFee: r.platform_fee,
    status: r.status as string,
    validFrom: r.valid_from as string,
    validTo: (r.valid_to as string) ?? null,
  }));
  const def = platformFeeSchema.safeParse(s.data?.value);
  return { agreements, brokerTerms, defaultPlatformFee: def.success ? def.data : null };
}

/** Plan (or re-plan) a deal from the terms in force today and store it through set_deal_plan(). */
export async function planAndStoreDeal(db: SupabaseClient, dealId: string): Promise<{ ok: boolean; message?: string; plan?: DealPlan }> {
  const { data: d, error } = await db.from("deals").select("*").eq("id", dealId).maybeSingle();
  if (error || !d) return { ok: false, message: error?.message ?? "Сделка не найдена" };
  if (!d.developer_org_id || !d.broker_org_id) return { ok: false, message: "У сделки не указан застройщик или брокер" };
  if (d.contract_price == null || !d.price_currency) return { ok: false, message: "Укажите цену договора и валюту" };

  const { agreements, brokerTerms, defaultPlatformFee } = await loadTerms(db, d.developer_org_id as string, d.broker_org_id as string);
  const out = buildPlanPayload(
    {
      dealId,
      developerOrgId: d.developer_org_id as string,
      brokerOrgId: d.broker_org_id as string,
      referrerOrgId: (d.referrer_org_id as string) ?? null,
      referralPercent: d.referral_percent != null ? Number(d.referral_percent) : null,
      projectId: (d.project_id as string) ?? null,
      contractPrice: Number(d.contract_price),
      netPrice: d.net_price != null ? Number(d.net_price) : null,
      priceCurrency: d.price_currency as string,
      fxRate: d.fx_rate != null ? Number(d.fx_rate) : null,
      date: (d.created_at as string).slice(0, 10),
    },
    agreements,
    brokerTerms,
    defaultPlatformFee,
  );
  if (!out.ok) return { ok: false, message: out.message };

  const { error: rpcErr } = await db.rpc("set_deal_plan", { p_deal: dealId, p_plan: out.payload });
  if (rpcErr) return { ok: false, message: rpcErr.message };
  await db.from("deals").update({ agreement_id: out.agreementId, broker_terms_id: out.brokerTermsId, referral_percent: out.payload.snapshot.referral_percent as number | null }).eq("id", dealId);
  return { ok: true, plan: out.plan };
}

/** Lead routing: exclusive agreement of the project/developer wins, else the configured default broker. */
export async function resolveLeadBroker(db: SupabaseClient, projectUuid: string | null, developerOrgId: string | null): Promise<string | null> {
  try {
    if (developerOrgId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await db
        .from("commission_agreements")
        .select("broker_org_id, project_id, valid_from, valid_to")
        .eq("developer_org_id", developerOrgId)
        .eq("status", "active")
        .eq("exclusive", true)
        .not("broker_org_id", "is", null)
        .lte("valid_from", today);
      const live = (data ?? []).filter((r) => !r.valid_to || (r.valid_to as string) >= today);
      const specific = live.find((r) => r.project_id && r.project_id === projectUuid);
      const general = live.find((r) => !r.project_id);
      const pick = specific ?? general;
      if (pick?.broker_org_id) return pick.broker_org_id as string;
    }
    const { data: s } = await db.from("platform_settings").select("value").eq("key", "lead_routing").maybeSingle();
    const v = s?.value as { default_broker_org_id?: string | null } | null | undefined;
    return v?.default_broker_org_id ?? null;
  } catch {
    return null;
  }
}
