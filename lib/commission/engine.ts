import {
  MILESTONES,
  type CommissionTerms,
  type Milestone,
  type PlatformFee,
} from "./terms";

/** Currencies without minor units. Everything else rounds to 2 decimals. */
const ZERO_DECIMAL = new Set(["VND", "KHR", "JPY"]);

export function roundMoney(n: number, currency: string): number {
  const d = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Gross commission owed by the developer for a given price (before min/max rounding to currency). */
export function computeGross(terms: CommissionTerms, price: number): number {
  if (!(price >= 0)) throw new Error("price must be non-negative");
  let c = 0;
  if (terms.model === "percent") {
    c = (price * (terms.percent ?? 0)) / 100;
  } else if (terms.model === "fixed") {
    c = terms.fixed ?? 0;
  } else {
    const tiers = [...(terms.tiers ?? [])].sort((a, b) => a.from - b.from);
    if (terms.tierMode === "bracket") {
      const hit = tiers.find((t) => price >= t.from && (t.to === null || price < t.to)) ?? tiers[tiers.length - 1];
      c = (price * (hit?.percent ?? 0)) / 100;
    } else {
      for (const t of tiers) {
        if (price <= t.from) break;
        const upper = t.to === null ? price : Math.min(price, t.to);
        c += ((upper - t.from) * t.percent) / 100;
      }
    }
  }
  if (terms.min !== null && c < terms.min) c = terms.min;
  if (terms.max !== null && c > terms.max) c = terms.max;
  return roundMoney(c, terms.currency);
}

/**
 * Split an amount across `percents` (summing to 100) so that the rounded parts add up exactly:
 * the last part receives the remainder.
 */
export function splitByPercent(total: number, percents: number[], currency: string): number[] {
  const out: number[] = [];
  let acc = 0;
  percents.forEach((p, i) => {
    if (i === percents.length - 1) out.push(roundMoney(total - acc, currency));
    else {
      const part = roundMoney((total * p) / 100, currency);
      out.push(part);
      acc += part;
    }
  });
  return out;
}

export function computePlatformFee(fee: PlatformFee | null, gross: number, currency: string): number {
  if (!fee || fee.type === "none") return 0;
  const v = fee.type === "percent" ? (gross * (fee.percent ?? 0)) / 100 : (fee.fixed ?? 0);
  return roundMoney(Math.min(v, gross), currency);
}

export interface DealPlanInput {
  terms: CommissionTerms;
  platformFee: PlatformFee | null;
  /** sale price in the deal currency */
  price: number;
  netPrice?: number | null;
  priceCurrency: string;
  /** units of commission currency per 1 unit of price currency (required when currencies differ) */
  fxRate?: number | null;
  /** organisation ids; the platform operator is represented by null */
  developerOrgId: string;
  brokerOrgId: string;
  referrerOrgId?: string | null;
  referralPercent?: number | null;
}

export type EntryKind = "commission" | "platform_fee" | "referral_fee" | "payout";

export interface PlannedEntry {
  milestone: Milestone;
  kind: EntryKind;
  payerOrg: string | null;
  payeeOrg: string | null;
  amount: number;
  currency: string;
  delayDays: number;
}

export interface DealPlan {
  currency: string;
  basisPrice: number;
  gross: number;
  platformFeeTotal: number;
  referralTotal: number;
  brokerNet: number;
  entries: PlannedEntry[];
}

/** Full commission plan of a deal: totals and the ledger entries per milestone. */
export function planDeal(i: DealPlanInput): DealPlan {
  const cur = i.terms.currency;
  let basis = i.terms.basis === "net_price" && i.netPrice != null ? i.netPrice : i.price;
  if (i.priceCurrency !== cur) {
    if (!i.fxRate || i.fxRate <= 0) throw new Error(`fx rate is required to convert ${i.priceCurrency} to ${cur}`);
    basis = basis * i.fxRate;
  }
  const gross = computeGross(i.terms, basis);
  const platformFeeTotal = computePlatformFee(i.platformFee, gross, cur);
  const referralTotal = i.referrerOrgId
    ? roundMoney(((i.referralPercent ?? 0) / 100) * gross, cur)
    : 0;
  if (platformFeeTotal + referralTotal > gross + 1e-9) throw new Error("platform fee and referral exceed the broker's commission");
  const brokerNet = roundMoney(gross - platformFeeTotal - referralTotal, cur);

  const sched = [...i.terms.schedule].sort((a, b) => MILESTONES.indexOf(a.event) - MILESTONES.indexOf(b.event));
  const pcts = sched.map((s) => s.percent);
  const gParts = splitByPercent(gross, pcts, cur);
  const fParts = splitByPercent(platformFeeTotal, pcts, cur);
  const rParts = splitByPercent(referralTotal, pcts, cur);
  const nParts = gParts.map((g, k) => roundMoney(g - fParts[k] - rParts[k], cur));

  const platform: string | null = null;
  const entries: PlannedEntry[] = [];
  sched.forEach((s, k) => {
    const base = { milestone: s.event, currency: cur, delayDays: s.delayDays };
    if (i.terms.payoutMode === "direct") {
      if (gParts[k] > 0) entries.push({ ...base, kind: "commission", payerOrg: i.developerOrgId, payeeOrg: i.brokerOrgId, amount: gParts[k] });
      if (fParts[k] > 0) entries.push({ ...base, kind: "platform_fee", payerOrg: i.brokerOrgId, payeeOrg: platform, amount: fParts[k] });
      if (rParts[k] > 0 && i.referrerOrgId) entries.push({ ...base, kind: "referral_fee", payerOrg: i.brokerOrgId, payeeOrg: i.referrerOrgId, amount: rParts[k] });
    } else {
      if (gParts[k] > 0) entries.push({ ...base, kind: "commission", payerOrg: i.developerOrgId, payeeOrg: platform, amount: gParts[k] });
      if (nParts[k] > 0) entries.push({ ...base, kind: "payout", payerOrg: platform, payeeOrg: i.brokerOrgId, amount: nParts[k] });
      if (rParts[k] > 0 && i.referrerOrgId) entries.push({ ...base, kind: "referral_fee", payerOrg: platform, payeeOrg: i.referrerOrgId, amount: rParts[k] });
    }
  });
  return { currency: cur, basisPrice: roundMoney(basis, cur), gross, platformFeeTotal, referralTotal, brokerNet, entries };
}

// ---------------------------------------------------------------------------
// Agreement resolution: the most specific valid agreement wins.
// ---------------------------------------------------------------------------
export interface AgreementLike {
  id: string;
  developerOrgId: string;
  brokerOrgId: string | null;
  projectId: string | null;
  status: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string | null;
}

export interface ResolveContext {
  developerOrgId: string;
  brokerOrgId: string;
  projectId: string | null;
  /** YYYY-MM-DD (the date the deal is registered) */
  date: string;
}

export function specificity(a: AgreementLike): number {
  return (a.projectId ? 2 : 0) + (a.brokerOrgId ? 1 : 0);
}

/** Returns the best agreement: project+broker > project > broker > developer default; newest wins ties. */
export function resolveAgreement<T extends AgreementLike>(list: T[], ctx: ResolveContext): T | null {
  const ok = list.filter(
    (a) =>
      a.status === "active" &&
      a.developerOrgId === ctx.developerOrgId &&
      (a.brokerOrgId === null || a.brokerOrgId === ctx.brokerOrgId) &&
      (a.projectId === null || a.projectId === ctx.projectId) &&
      a.validFrom <= ctx.date &&
      (a.validTo === null || a.validTo >= ctx.date),
  );
  if (!ok.length) return null;
  ok.sort((a, b) => specificity(b) - specificity(a) || (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : 0));
  return ok[0];
}

export interface BrokerTermsLike {
  id: string;
  brokerOrgId: string;
  developerOrgId: string | null;
  status: string;
  validFrom: string;
  validTo: string | null;
}

/** broker+developer override > broker default. */
export function resolveBrokerTerms<T extends BrokerTermsLike>(list: T[], brokerOrgId: string, developerOrgId: string, date: string): T | null {
  const ok = list.filter(
    (t) =>
      t.status === "active" &&
      t.brokerOrgId === brokerOrgId &&
      (t.developerOrgId === null || t.developerOrgId === developerOrgId) &&
      t.validFrom <= date &&
      (t.validTo === null || t.validTo >= date),
  );
  if (!ok.length) return null;
  ok.sort((a, b) => (b.developerOrgId ? 1 : 0) - (a.developerOrgId ? 1 : 0) || (a.validFrom < b.validFrom ? 1 : -1));
  return ok[0];
}
