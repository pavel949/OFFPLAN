export type Freshness = "fresh" | "stale" | "expired";

export const FRESH_DAYS = 14;
export const EXPIRED_DAYS = 30;

const DAY = 86_400_000;

/** fresh ≤ 14 days · stale 15–30 days · expired > 30 days (price must be re-confirmed). */
export function freshnessOf(iso: string | null | undefined, now = Date.now()): Freshness {
  if (!iso) return "expired";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "expired";
  const days = (now - t) / DAY;
  if (days <= FRESH_DAYS) return "fresh";
  if (days <= EXPIRED_DAYS) return "stale";
  return "expired";
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now - t) / DAY);
}

export function summarizeFreshness(
  rows: { price_updated_at?: string | null; status?: string }[],
  now = Date.now(),
): { fresh: number; stale: number; expired: number; active: number } {
  const out = { fresh: 0, stale: 0, expired: 0, active: 0 };
  for (const r of rows) {
    if (r.status === "sold") continue;
    out.active += 1;
    out[freshnessOf(r.price_updated_at, now)] += 1;
  }
  return out;
}

export const CURRENCY_SYMBOL: Record<string, string> = {
  THB: "฿",
  USD: "$",
  EUR: "€",
  RUB: "₽",
  VND: "₫",
};

export function formatPrice(amount: number | null, currency: string, lang: "ru" | "en"): string {
  if (amount == null) return "—";
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const n = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 0 }).format(amount);
  return `${sym} ${n}`;
}
