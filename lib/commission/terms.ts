import { z } from "zod";

/** Deal milestones that release commission. They map 1:1 to deal statuses. */
export const MILESTONES = ["reserved", "contract_signed", "won"] as const;
export type Milestone = (typeof MILESTONES)[number];

export const MILESTONE_RU: Record<Milestone, string> = {
  reserved: "Бронирование",
  contract_signed: "Подписание договора",
  won: "Сдача / завершение сделки",
};

const pct = z.number().min(0).max(100);
const money = z.number().min(0);

export const tierSchema = z.object({
  from: money,
  to: money.nullable(), // null = open-ended
  percent: pct,
});

export const scheduleItemSchema = z.object({
  event: z.enum(MILESTONES),
  percent: z.number().gt(0).max(100),
  /** payable N days after the event */
  delayDays: z.number().int().min(0).max(365).default(0),
});

/** Developer → broker commission terms (one agreement). */
export const commissionTermsSchema = z
  .object({
    model: z.enum(["percent", "fixed", "tiered"]),
    percent: pct.optional(),
    fixed: money.optional(),
    tiers: z.array(tierSchema).optional(),
    /** marginal: each band is charged at its own rate; bracket: the whole price at the matching band's rate */
    tierMode: z.enum(["marginal", "bracket"]).default("marginal"),
    min: money.nullable().default(null),
    max: money.nullable().default(null),
    /** contract_price, or net_price (excluding taxes/fees) when the deal carries it */
    basis: z.enum(["contract_price", "net_price"]).default("contract_price"),
    currency: z.string().regex(/^[A-Z]{3}$/).default("THB"),
    schedule: z.array(scheduleItemSchema).min(1),
    /** direct: developer pays the broker; via_platform: developer pays the platform which remits */
    payoutMode: z.enum(["direct", "via_platform"]).default("direct"),
    /** informational: commission is quoted excluding VAT; VAT is added on the invoice */
    vatPercent: pct.default(0),
    clawbackDays: z.number().int().min(0).max(1095).default(0),
  })
  .superRefine((t, ctx) => {
    if (t.model === "percent" && t.percent === undefined) ctx.addIssue({ code: "custom", message: "percent is required", path: ["percent"] });
    if (t.model === "fixed" && t.fixed === undefined) ctx.addIssue({ code: "custom", message: "fixed amount is required", path: ["fixed"] });
    if (t.model === "tiered") {
      if (!t.tiers?.length) ctx.addIssue({ code: "custom", message: "tiers are required", path: ["tiers"] });
      else {
        const sorted = [...t.tiers].sort((a, b) => a.from - b.from);
        for (let i = 0; i < sorted.length; i++) {
          const cur = sorted[i];
          if (cur.to !== null && cur.to <= cur.from) ctx.addIssue({ code: "custom", message: `tier ${i + 1}: 'to' must exceed 'from'`, path: ["tiers"] });
          if (i > 0 && sorted[i - 1].to !== cur.from) ctx.addIssue({ code: "custom", message: "tiers must be contiguous (each 'from' equals previous 'to')", path: ["tiers"] });
          if (i < sorted.length - 1 && cur.to === null) ctx.addIssue({ code: "custom", message: "only the last tier may be open-ended", path: ["tiers"] });
        }
        if (sorted[0].from !== 0) ctx.addIssue({ code: "custom", message: "the first tier must start at 0", path: ["tiers"] });
      }
    }
    if (t.min !== null && t.max !== null && t.min > t.max) ctx.addIssue({ code: "custom", message: "min exceeds max", path: ["min"] });
    const total = t.schedule.reduce((s, x) => s + x.percent, 0);
    if (Math.abs(total - 100) > 1e-9) ctx.addIssue({ code: "custom", message: `schedule must total 100% (now ${total}%)`, path: ["schedule"] });
    const seen = new Set<string>();
    for (const s of t.schedule) {
      if (seen.has(s.event)) ctx.addIssue({ code: "custom", message: `duplicate milestone ${s.event}`, path: ["schedule"] });
      seen.add(s.event);
    }
  });

export type CommissionTerms = z.infer<typeof commissionTermsSchema>;

/** Broker ↔ platform terms: what the platform keeps out of the broker's commission. */
export const platformFeeSchema = z
  .object({
    type: z.enum(["none", "percent", "fixed"]).default("none"),
    percent: pct.optional(),
    fixed: money.optional(),
    /** default referral share (percent of the broker's gross) when a deal has a referrer */
    referralDefaultPercent: pct.default(0),
  })
  .superRefine((f, ctx) => {
    if (f.type === "percent" && f.percent === undefined) ctx.addIssue({ code: "custom", message: "percent is required", path: ["percent"] });
    if (f.type === "fixed" && f.fixed === undefined) ctx.addIssue({ code: "custom", message: "fixed fee is required", path: ["fixed"] });
  });

export type PlatformFee = z.infer<typeof platformFeeSchema>;

export const DEFAULT_SCHEDULE: CommissionTerms["schedule"] = [
  { event: "reserved", percent: 30, delayDays: 0 },
  { event: "contract_signed", percent: 40, delayDays: 0 },
  { event: "won", percent: 30, delayDays: 0 },
];
