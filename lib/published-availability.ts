import type { SalesModel } from "./sales-model";
import { publicSalesProjection, type PublicUnitIdentity } from "./sales-public";

/** A lower bound from published priced offers, never a complete inventory census. */
export type PublishedAvailability = {
  available: number;
  observedAt: string;
  expiresAt: string;
  coverage: "published-offers";
  fromPrice?: { amount: number; currency: string; ownership: string; priceDate: string };
  pricing?: { currency: string; ownership: string; bedrooms: number | null; from: number }[];
};

export function publishedAvailability(
  model: SalesModel,
  publication: { revision: number; expires_at: string },
  units: PublicUnitIdentity[],
  now = Date.now(),
): PublishedAvailability | null {
  const deadline = Date.parse(publication.expires_at);
  if (!Number.isFinite(deadline) || deadline <= now) return null;
  const offers = publicSalesProjection(model, publication.revision, units, new Date(now).toISOString().slice(0, 10)).offers;
  // An empty/partial price list cannot prove that a development is sold out.
  if (!offers.length) return null;
  const observedAt = offers.map(o => o.availabilityDate).sort()[0];
  const expiries = offers.flatMap(o => [
    Date.parse(`${o.availabilityDate}T00:00:00Z`) + 31 * 86400000,
    Date.parse(`${o.priceDate}T00:00:00Z`) + 31 * 86400000,
    ...(o.validUntil ? [Date.parse(`${o.validUntil}T00:00:00Z`) + 86400000] : []),
  ]);
  const thb = offers.filter(o=>o.currency === "THB").sort((a,b)=>a.price-b.price);
  const cheapest = thb[0];
  const grouped = new Map<string,{currency:string;ownership:string;bedrooms:number|null;from:number}>();
  for (const o of offers) {
    const bedrooms = o.bedrooms ?? null;
    const key = `${o.currency}:${o.ownership}:${bedrooms}`;
    const previous = grouped.get(key);
    if (!previous || o.price < previous.from) grouped.set(key,{currency:o.currency,ownership:o.ownership,bedrooms,from:o.price});
  }
  return {
    ...(cheapest ? {fromPrice:{amount:cheapest.price,currency:cheapest.currency,ownership:cheapest.ownership,priceDate:cheapest.priceDate}} : {}),
    pricing:[...grouped.values()],
    available: new Set(offers.map(o => o.unitId)).size,
    observedAt,
    expiresAt: new Date(Math.min(deadline, ...expiries)).toISOString(),
    coverage: "published-offers",
  };
}

export function currentAvailability(value: PublishedAvailability | undefined | null, now = Date.now()) {
  return value && value.available > 0 && Date.parse(value.expiresAt) > now ? value : null;
}

export function availabilityLabel(count: number, type: string) {
  const forms = type === "condo" ? ["квартира", "квартиры", "квартир"] : type === "villa" ? ["вилла", "виллы", "вилл"] : type === "house" ? ["дом", "дома", "домов"] : ["лот", "лота", "лотов"];
  const tail = count % 100;
  const form = tail >= 11 && tail <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2;
  return `${count} ${forms[form]} в продаже`;
}
