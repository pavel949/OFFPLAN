import { describe, expect, it } from "vitest";
import { emptySalesModel, salesModelBase } from "./sales-model";
import { partnerSalesView, preparePartnerSales, PRIVATE_SALES_SOURCE } from "./partner-sales";
import { publicSalesProjection } from "./sales-public";
const uid = "00000000-0000-4000-8000-000000000001";
const oid = "00000000-0000-4000-8000-000000000002";
function fixture() {
  const m = emptySalesModel();
  m.units = [salesModelBase.shape.units.element.parse({ id: uid, kind: "apartment", availability: "available", source: "PRIVATE availability", sourceDate: "2026-11-05", checkedOn: "2026-11-05", verification: "verified" })];
  m.offers = [salesModelBase.shape.offers.element.parse({ id: oid, unitId: uid, name: "A101", ownership: "freehold", price: 1000000, currency: "THB", priceTaxTreatment: "unknown", status: "offered", source: "PRIVATE price", sourceDate: "2026-11-05" })];
  return m;
}
describe("partner sales evidence boundary", () => {
  it("removes internal sources, notes and payee details without changing buyer facts", () => {
    const m = fixture();
    const view = partnerSalesView(m);
    expect(JSON.stringify(view)).not.toContain("PRIVATE");
    expect(view.units[0].checkedOn).toBe("");
    expect(view.units[0].verification).toBe("documented");
    expect(view.offers[0].price).toBe(1000000);
    expect(m.units[0].verification).toBe("verified");
  });
  it("round-trips unchanged rows with original private evidence intact", () => {
    const m = fixture();
    expect(preparePartnerSales(partnerSalesView(m), m)).toEqual(m);
  });
  it("does not let a changed price inherit hidden evidence", () => {
    const m = fixture(), view = partnerSalesView(m);
    view.offers[0].price = 2000000;
    expect(() => preparePartnerSales(view, m)).toThrow("собственный источник");
  });
  it("requires a new dated source and cannot self-assign verified status", () => {
    const m = fixture(), view = partnerSalesView(m);
    view.offers[0] = { ...view.offers[0], price: 2000000, source: "Developer dated price", verification: "verified", checkedOn: "2026-11-05" };
    const next = preparePartnerSales(view, m);
    expect(next.offers[0].verification).toBe("documented");
    expect(next.offers[0].checkedOn).toBe("");
    expect(next.units[0].source).toBe("PRIVATE availability");
    expect(publicSalesProjection(next, 2, [{ id: uid, label: "A101", status: "unknown" }], "2026-11-05").offers[0].price).toBe(2000000);
  });
  it("preserves physical-stock veto and does not silently convert area units", () => {
    const m = fixture(), view = partnerSalesView(m);
    expect(publicSalesProjection(m, 1, [{ id: uid, label: "A101", status: "sold" }], "2026-11-05").offers).toEqual([]);
    view.areaUnit = "sqft";
    expect(() => preparePartnerSales(view, m)).toThrow("единицу площади");
  });
  it("rejects new rows claiming another row's private source", () => {
    const m = fixture(), view = partnerSalesView(m);
    view.offers[0].id = "00000000-0000-4000-8000-000000000003";
    view.offers[0].source = PRIVATE_SALES_SOURCE;
    expect(() => preparePartnerSales(view, m)).toThrow();
  });
});
