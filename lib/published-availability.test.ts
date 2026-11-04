import { describe, it, expect } from "vitest";
import { emptySalesModel, salesModelBase } from "./sales-model";
import { publishedAvailability, currentAvailability, availabilityLabel } from "./published-availability";
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const now=Date.parse("2026-11-04T13:00:00Z");
const publication={revision:1,expires_at:"2026-11-05T13:00:00Z"};
function fixture(){
  const model=emptySalesModel();
  model.units=[salesModelBase.shape.units.element.parse({id:id(1),kind:"apartment",availability:"available",sourceDate:"2026-11-04"})];
  model.offers=[salesModelBase.shape.offers.element.parse({id:id(2),unitId:id(1),name:"A101",ownership:"leasehold",currency:"THB",priceTaxTreatment:"unknown",price:1000000,status:"offered",sourceDate:"2026-11-04"})];
  const units=[{id:id(1),label:"A-101",status:"available"}];
  return {model,units};
}
describe("published availability on project cards",()=>{
  it("counts physical units once across ownership offers and labels partial coverage",()=>{
    const {model,units}=fixture();model.offers.push({...model.offers[0],id:id(3),ownership:"freehold"});
    expect(publishedAvailability(model,publication,units,now)).toEqual({available:1,observedAt:"2026-11-04",expiresAt:publication.expires_at.replace("Z",".000Z"),coverage:"published-offers"});
  });
  it("treats expired/invalid publication as unknown",()=>{
    const {model,units}=fixture();
    for(const expires_at of ["2026-11-04T12:59:59Z","invalid"])
      expect(publishedAvailability(model,{revision:1,expires_at},units,now)).toBeNull();
  });
  it("never invents zero when no price, no identities, sold, stale or future source",()=>{
    for(const scenario of ["empty","missing","sold","stale","future","no-price"]){
      const {model,units}=fixture();
      if(scenario==="empty")model.offers=[];
      if(scenario==="missing")units.length=0;
      if(scenario==="sold")units[0].status="sold";
      if(scenario==="stale")model.units[0].sourceDate="2026-09-01";
      if(scenario==="future")model.units[0].sourceDate="2026-11-05";
      if(scenario==="no-price")model.offers[0].price=null;
      expect(publishedAvailability(model,publication,units,now)).toBeNull();
    }
  });
  it("uses oldest availability evidence and earliest offer expiry",()=>{
    const {model,units}=fixture();model.units.push({...model.units[0],id:id(3),sourceDate:"2026-11-02"});units.push({...units[0],id:id(3)});
    model.offers.push({...model.offers[0],id:id(4),unitId:id(3),validUntil:"2026-11-04"});
    expect(publishedAvailability(model,publication,units,now)).toMatchObject({available:2,observedAt:"2026-11-02",expiresAt:"2026-11-05T00:00:00.000Z"});
  });
  it("expires an already rendered summary at its deadline",()=>{
    const {model,units}=fixture();const summary=publishedAvailability(model,publication,units,now);
    expect(currentAvailability(summary,now)?.available).toBe(1);
    expect(currentAvailability(summary,Date.parse(publication.expires_at))).toBeNull();
    expect(currentAvailability(undefined,now)).toBeNull();
  });
  it("formats apartment and villa counts",()=>{
    expect(availabilityLabel(29,"condo")).toBe("29 квартир в продаже");
    expect(availabilityLabel(21,"villa")).toBe("21 вилла в продаже");
    expect(availabilityLabel(12,"condo")).toBe("12 квартир в продаже");
  });
});
