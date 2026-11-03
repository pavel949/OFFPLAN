import { describe, expect, it } from "vitest";
import { computeGross, planDeal, resolveAgreement, resolveBrokerTerms, roundMoney, splitByPercent } from "./engine";
import { commissionTermsSchema, DEFAULT_SCHEDULE, platformFeeSchema, type CommissionTerms } from "./terms";

const terms = (o: Record<string, unknown> = {}): CommissionTerms =>
  commissionTermsSchema.parse({ model: "percent", percent: 4, schedule: DEFAULT_SCHEDULE, ...o });

describe("computeGross", () => {
  it("percent, fixed and min/max", () => {
    expect(computeGross(terms(), 10_000_000)).toBe(400_000);
    expect(computeGross(terms({ model: "fixed", fixed: 150_000 }), 99)).toBe(150_000);
    expect(computeGross(terms({ min: 500_000 }), 10_000_000)).toBe(500_000);
    expect(computeGross(terms({ max: 300_000 }), 10_000_000)).toBe(300_000);
  });
  it("tiered: marginal vs bracket", () => {
    const tiers = [
      { from: 0, to: 10_000_000, percent: 5 },
      { from: 10_000_000, to: null, percent: 3 },
    ];
    // 15M: 10M*5% + 5M*3% = 650k
    expect(computeGross(terms({ model: "tiered", tiers, tierMode: "marginal" }), 15_000_000)).toBe(650_000);
    // bracket: whole 15M at 3% = 450k
    expect(computeGross(terms({ model: "tiered", tiers, tierMode: "bracket" }), 15_000_000)).toBe(450_000);
    expect(computeGross(terms({ model: "tiered", tiers, tierMode: "marginal" }), 4_000_000)).toBe(200_000);
  });
  it("rounds by currency", () => {
    expect(roundMoney(1.005, "THB")).toBe(1.01);
    expect(roundMoney(1234.6, "VND")).toBe(1235);
  });
});

describe("terms validation", () => {
  it("rejects a schedule that does not total 100%", () => {
    expect(() => terms({ schedule: [{ event: "reserved", percent: 50 }] })).toThrow(/100%/);
  });
  it("rejects duplicate milestones and broken tiers", () => {
    expect(() => terms({ schedule: [{ event: "won", percent: 50 }, { event: "won", percent: 50 }] })).toThrow(/duplicate/);
    expect(() => terms({ model: "tiered", tiers: [{ from: 0, to: 5, percent: 1 }, { from: 6, to: null, percent: 2 }] })).toThrow(/contiguous/);
    expect(() => terms({ model: "tiered", tiers: [{ from: 1, to: null, percent: 1 }] })).toThrow(/start at 0/);
    expect(() => terms({ model: "percent", percent: undefined })).toThrow(/percent is required/);
  });
  it("validates platform fee config", () => {
    expect(() => platformFeeSchema.parse({ type: "percent" })).toThrow();
    expect(platformFeeSchema.parse({ type: "none" }).referralDefaultPercent).toBe(0);
  });
});

describe("splitByPercent", () => {
  it("always adds up exactly", () => {
    const parts = splitByPercent(100_000.01, [33.33, 33.33, 33.34], "THB");
    expect(roundMoney(parts.reduce((a, b) => a + b, 0), "THB")).toBe(100_000.01);
  });
});

describe("planDeal", () => {
  const base = {
    platformFee: { type: "percent" as const, percent: 20, referralDefaultPercent: 0 },
    price: 10_000_000,
    priceCurrency: "THB",
    developerOrgId: "DEV",
    brokerOrgId: "BRK",
  };

  it("direct payout: developer pays broker, broker pays platform fee", () => {
    const p = planDeal({ ...base, terms: terms() });
    expect(p.gross).toBe(400_000);
    expect(p.platformFeeTotal).toBe(80_000);
    expect(p.brokerNet).toBe(320_000);
    const comm = p.entries.filter((e) => e.kind === "commission");
    expect(comm.map((e) => e.amount)).toEqual([120_000, 160_000, 120_000]);
    expect(comm.every((e) => e.payerOrg === "DEV" && e.payeeOrg === "BRK")).toBe(true);
    const fee = p.entries.filter((e) => e.kind === "platform_fee");
    expect(fee.reduce((s, e) => s + e.amount, 0)).toBe(80_000);
    expect(fee.every((e) => e.payerOrg === "BRK" && e.payeeOrg === null)).toBe(true);
  });

  it("via platform: developer pays the platform which pays the broker net", () => {
    const p = planDeal({ ...base, terms: terms({ payoutMode: "via_platform" }) });
    const comm = p.entries.filter((e) => e.kind === "commission");
    expect(comm.every((e) => e.payerOrg === "DEV" && e.payeeOrg === null)).toBe(true);
    const payout = p.entries.filter((e) => e.kind === "payout");
    expect(payout.reduce((s, e) => s + e.amount, 0)).toBe(320_000);
    expect(payout.every((e) => e.payerOrg === null && e.payeeOrg === "BRK")).toBe(true);
  });

  it("referral fee reduces the broker net", () => {
    const p = planDeal({ ...base, terms: terms(), referrerOrgId: "REF", referralPercent: 10 });
    expect(p.referralTotal).toBe(40_000);
    expect(p.brokerNet).toBe(280_000);
    const ref = p.entries.filter((e) => e.kind === "referral_fee");
    expect(ref.reduce((s, e) => s + e.amount, 0)).toBe(40_000);
    expect(ref.every((e) => e.payeeOrg === "REF")).toBe(true);
  });

  it("entries per milestone sum back to the totals", () => {
    const p = planDeal({ ...base, price: 7_777_777, terms: terms({ percent: 3.3 }), referrerOrgId: "REF", referralPercent: 7 });
    const sum = (k: string) => roundMoney(p.entries.filter((e) => e.kind === k).reduce((s, e) => s + e.amount, 0), "THB");
    expect(sum("commission")).toBe(p.gross);
    expect(sum("platform_fee")).toBe(p.platformFeeTotal);
    expect(sum("referral_fee")).toBe(p.referralTotal);
  });

  it("converts currency and requires an fx rate", () => {
    const t = terms({ currency: "THB" });
    expect(() => planDeal({ ...base, terms: t, priceCurrency: "USD", price: 300_000 })).toThrow(/fx rate/);
    const p = planDeal({ ...base, terms: t, priceCurrency: "USD", price: 300_000, fxRate: 35 });
    expect(p.basisPrice).toBe(10_500_000);
    expect(p.gross).toBe(420_000);
  });

  it("uses the net price when the agreement is based on it", () => {
    const p = planDeal({ ...base, terms: terms({ basis: "net_price" }), netPrice: 9_000_000 });
    expect(p.gross).toBe(360_000);
  });

  it("rejects a fee configuration that exceeds the commission", () => {
    expect(() => planDeal({ ...base, terms: terms(), platformFee: { type: "percent", percent: 80, referralDefaultPercent: 0 }, referrerOrgId: "R", referralPercent: 30 })).toThrow(/exceed/);
  });
});

describe("agreement resolution", () => {
  const A = (o: Record<string, unknown>) => ({
    id: "x", developerOrgId: "DEV", brokerOrgId: null, projectId: null, status: "active", validFrom: "2026-01-01", validTo: null, ...o,
  }) as Parameters<typeof resolveAgreement>[0][number];
  const ctx = { developerOrgId: "DEV", brokerOrgId: "BRK", projectId: "P1", date: "2026-06-01" };

  it("picks the most specific valid agreement", () => {
    const list = [A({ id: "default" }), A({ id: "broker", brokerOrgId: "BRK" }), A({ id: "project", projectId: "P1" }), A({ id: "both", brokerOrgId: "BRK", projectId: "P1" })];
    expect(resolveAgreement(list, ctx)?.id).toBe("both");
    expect(resolveAgreement(list.slice(0, 3), ctx)?.id).toBe("project");
    expect(resolveAgreement([list[0], list[1]], ctx)?.id).toBe("broker");
  });
  it("ignores inactive, expired, future and other parties", () => {
    const list = [
      A({ id: "draft", status: "draft", projectId: "P1" }),
      A({ id: "expired", validTo: "2026-03-01", projectId: "P1" }),
      A({ id: "future", validFrom: "2026-09-01", projectId: "P1" }),
      A({ id: "other-broker", brokerOrgId: "ZZZ" }),
      A({ id: "other-project", projectId: "P2" }),
      A({ id: "other-dev", developerOrgId: "DEV2" }),
    ];
    expect(resolveAgreement(list, ctx)).toBeNull();
  });
  it("the newest agreement wins among equals", () => {
    const list = [A({ id: "old", validFrom: "2026-01-01" }), A({ id: "new", validFrom: "2026-05-01" })];
    expect(resolveAgreement(list, ctx)?.id).toBe("new");
  });
  it("broker terms: developer override beats broker default", () => {
    const T = (o: Record<string, unknown>) => ({ id: "t", brokerOrgId: "BRK", developerOrgId: null, status: "active", validFrom: "2026-01-01", validTo: null, ...o }) as Parameters<typeof resolveBrokerTerms>[0][number];
    expect(resolveBrokerTerms([T({ id: "def" }), T({ id: "ovr", developerOrgId: "DEV" })], "BRK", "DEV", "2026-06-01")?.id).toBe("ovr");
    expect(resolveBrokerTerms([T({ id: "def" }), T({ id: "ovr", developerOrgId: "DEV2" })], "BRK", "DEV", "2026-06-01")?.id).toBe("def");
    expect(resolveBrokerTerms([], "BRK", "DEV", "2026-06-01")).toBeNull();
  });
});

import { buildPlanPayload, type AgreementRow, type BrokerTermsRow } from "./service";

describe("buildPlanPayload", () => {
  const ag = (o: Partial<AgreementRow> = {}): AgreementRow => ({
    id: "A1", name: "std", developerOrgId: "DEV", brokerOrgId: null, projectId: null, exclusive: false,
    status: "active", validFrom: "2026-01-01", validTo: null,
    terms: { model: "percent", percent: 4, schedule: DEFAULT_SCHEDULE }, ...o,
  });
  const bt = (o: Partial<BrokerTermsRow> = {}): BrokerTermsRow => ({
    id: "B1", brokerOrgId: "BRK", developerOrgId: null, status: "active", validFrom: "2026-01-01", validTo: null,
    platformFee: { type: "percent", percent: 20 }, ...o,
  });
  const input = { dealId: "D", developerOrgId: "DEV", brokerOrgId: "BRK", referrerOrgId: null, referralPercent: null, projectId: "P", contractPrice: 10_000_000, netPrice: null, priceCurrency: "THB", fxRate: null, date: "2026-06-01" };

  it("builds the payload expected by set_deal_plan", () => {
    const r = buildPlanPayload(input, [ag()], [bt()]);
    if (!r.ok) throw new Error(r.message);
    expect(r.payload.totals).toMatchObject({ gross: 400_000, platform_fee_total: 80_000, broker_net: 320_000, currency: "THB" });
    expect(r.payload.entries.length).toBe(6);
    expect(r.payload.entries[0]).toMatchObject({ milestone: "reserved", kind: "commission", payer_org: "DEV", payee_org: "BRK" });
    expect(r.payload.snapshot).toMatchObject({ agreement_id: "A1", broker_terms_id: "B1" });
  });
  it("different developers/brokers get different terms", () => {
    const agreements = [ag(), ag({ id: "A2", developerOrgId: "DEV", brokerOrgId: "BRK", terms: { model: "percent", percent: 6, schedule: DEFAULT_SCHEDULE } })];
    const special = buildPlanPayload(input, agreements, [bt()]);
    const other = buildPlanPayload({ ...input, brokerOrgId: "BRK2" }, agreements, []);
    if (!special.ok || !other.ok) throw new Error("plan failed");
    expect(special.payload.totals.gross).toBe(600_000); // broker-specific agreement
    expect(other.payload.totals.gross).toBe(400_000);   // default agreement for any other broker
    expect(other.payload.totals.platform_fee_total).toBe(0); // no broker terms => no platform fee
  });
  it("reports a missing agreement and invalid terms in Russian", () => {
    const none = buildPlanPayload(input, [], []);
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toBe("no_agreement");
    const bad = buildPlanPayload(input, [ag({ terms: { model: "percent" } })], []);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("invalid_terms");
  });
  it("uses the default platform fee when the broker has no terms", () => {
    const r = buildPlanPayload(input, [ag()], [], { type: "percent", percent: 10, referralDefaultPercent: 0 });
    if (!r.ok) throw new Error(r.message);
    expect(r.payload.totals.platform_fee_total).toBe(40_000);
  });
  it("applies the default referral share from broker terms", () => {
    const r = buildPlanPayload({ ...input, referrerOrgId: "REF" }, [ag()], [bt({ platformFee: { type: "none", referralDefaultPercent: 15 } })]);
    if (!r.ok) throw new Error(r.message);
    expect(r.payload.totals.referral_total).toBe(60_000);
  });
});

import { summarizeTerms } from "./format";

describe("summarizeTerms", () => {
  it("describes percent terms in Russian", () => {
    const s = summarizeTerms(terms({ min: 100000 }));
    expect(s).toContain("4% от цены");
    expect(s).toContain("мин.");
    expect(s).toContain("напрямую");
  });
  it("tolerates garbage", () => {
    expect(summarizeTerms(null)).toBe("—");
    expect(summarizeTerms({})).toBe("—");
  });
});
