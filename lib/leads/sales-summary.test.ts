import { describe,it,expect } from "vitest";
import { leadSalesSummary,leadSalesLines } from "./sales-summary";
const offer={id:"00000000-0000-4000-8000-000000000001",unitId:"00000000-0000-4000-8000-000000000002",revision:2,label:"A-201",ownership:"leasehold",price:12139628,currency:"THB",priceDate:"2026-11-04",availabilityDate:"2026-11-04",source:"PRIVATE",seller:"PRIVATE",fees:[]};
describe("lead commercial summary",()=>{
 it("preserves the exact variant, price and revision but strips private or extra fields",()=>{expect(leadSalesSummary(offer)).toMatchObject({unit_label:"A-201",ownership:"leasehold",price:12139628,currency:"THB",sales_revision:2});expect(JSON.stringify(leadSalesSummary(offer))).not.toContain("PRIVATE");expect(leadSalesLines(offer)).toContain("Ownership: leasehold");});
 it("treats general, malformed and legacy selections as absent",()=>{for(const v of [undefined,null,{}, {...offer,price:-1},{...offer,ownership:"invented"}])expect(leadSalesSummary(v)).toBeNull();});
});
