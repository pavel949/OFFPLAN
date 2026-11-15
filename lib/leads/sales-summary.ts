import { z } from "zod";

/** Minimal public commercial selection. Never forward private model/source fields. */
const selection = z.object({
  id:z.uuid(), unitId:z.uuid(), revision:z.number().int().positive(), label:z.string().max(200),
  ownership:z.enum(["unknown","leasehold","freehold","other"]),
  price:z.number().finite().nonnegative(), currency:z.string().regex(/^[A-Z]{3}$/),
  priceDate:z.iso.date(), availabilityDate:z.iso.date(),
});
export function leadSalesSummary(value: unknown) {
  const r=selection.safeParse(value);if(!r.success)return null;
  const o=r.data;
  return {offer_id:o.id,unit_id:o.unitId,sales_revision:o.revision,unit_label:o.label,ownership:o.ownership,price:o.price,currency:o.currency,price_date:o.priceDate,availability_date:o.availabilityDate};
}
export type LeadSalesSummary=NonNullable<ReturnType<typeof leadSalesSummary>>;
export function leadSalesLines(value:unknown) {
  const o=leadSalesSummary(value);
  return o ? [`Unit: ${o.unit_label}`,`Ownership: ${o.ownership}`,`Price: ${o.price} ${o.currency}`,`Price date: ${o.price_date}`,`Availability date: ${o.availability_date}`,`Offer: ${o.offer_id}`,`Sales revision: ${o.sales_revision}`] : [];
}
