import {describe,it,expect} from "vitest";
import {emptySalesModel,salesModelBase,salesModelSchema} from "./sales-model";
import {publicSalesProjection} from "./sales-public";
const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function fixture(){
 const m=emptySalesModel();
 m.units=[salesModelBase.shape.units.element.parse({id:uid(1),kind:"apartment",availability:"available",source:"PRIVATE unit list",sourceDate:"2026-11-04"})];
 m.offers=[salesModelBase.shape.offers.element.parse({id:uid(2),unitId:uid(1),name:"A101 freehold",ownership:"freehold",price:1e6,currency:"THB",priceTaxTreatment:"unknown",status:"offered",source:"PRIVATE price list",sourceDate:"2026-11-04"})];
 return salesModelSchema.parse(m);
}
const identities=[{id:uid(1),label:"A101",status:"unknown"}];
describe("sales publication projection",()=>{
 it("projects a priced offer using physical identity without leaking sources",()=>{
  const out=publicSalesProjection(fixture(),3,identities,"2026-11-04");expect(out.offers[0]).toMatchObject({label:"A101",price:1e6,revision:3});expect(JSON.stringify(out)).not.toContain("PRIVATE");
 });
 it("hides draft, withdrawn and expired offers",()=>{
  const m=fixture();m.offers[0].status="draft";expect(publicSalesProjection(m,1,identities,"2026-11-04").offers).toEqual([]);
  m.offers[0].status="offered";m.offers[0].validUntil="2026-11-03";expect(publicSalesProjection(m,1,identities,"2026-11-04").offers).toEqual([]);
 });
 it("hides old or future price and availability evidence",()=>{
  for(const key of ["units","offers"] as const){const m=fixture();m[key][0].sourceDate="2026-09-01";expect(publicSalesProjection(m,1,identities,"2026-11-04").offers).toEqual([]);m[key][0].sourceDate="2026-12-01";expect(publicSalesProjection(m,1,identities,"2026-11-04").offers).toEqual([]);}
 });
 it("stops showing a deleted, sold or reserved physical unit",()=>{
  expect(publicSalesProjection(fixture(),1,[],"2026-11-04").offers).toEqual([]);
  for(const status of ["sold","reserved"])expect(publicSalesProjection(fixture(),1,[{...identities[0],status}],"2026-11-04").offers).toEqual([]);
 });
 it("does not publish unknown availability",()=>{const m=fixture();m.units[0].availability="unknown";expect(publicSalesProjection(m,1,identities,"2026-11-04").offers).toEqual([]);});
 it("keeps two ownership offers on one unit without duplicating its identity",()=>{const m=fixture();m.offers.push({...m.offers[0],id:uid(3),ownership:"leasehold"});const out=publicSalesProjection(m,1,identities,"2026-11-04");expect(out.offers).toHaveLength(2);expect(new Set(out.offers.map(o=>o.unitId)).size).toBe(1);});
});
