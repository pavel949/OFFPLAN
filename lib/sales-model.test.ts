import { describe,it,expect } from "vitest";
import { emptySalesModel,salesModelSchema,salesModelBase,applicableFees,feePreview,paymentPreview } from "./sales-model";
import { formDefault,salesFormSchema } from "./sales-form";

const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
function unit(n=1) {return salesModelBase.shape.units.element.parse({id:uid(n),kind:"apartment"});}
function fee(n=2) {return salesModelBase.shape.fees.element.parse({id:uid(n),name:"CAM",code:"cam",category:"maintenance",treatment:"payable",mandatory:"required",basis:"per_total_area",amount:85,currency:"THB",period:"month",taxTreatment:"included",payer:"buyer"});}
function plan() {return salesModelBase.shape.paymentPlans.element.parse({id:uid(10),name:"Construction",currency:"THB",financing:"construction_installments",approval:"unknown",rateMethod:"interest_free",annualRate:0,interestIncluded:"included",depositAmount:100000,depositTreatment:"credited_to_price",depositRefund:"conditional",depositCreditStepId:uid(11),escrow:"unknown",completeness:"complete",steps:[{id:uid(11),name:"Contract",trigger:"contract",basis:"percent_price",value:20},{id:uid(12),name:"Handover",trigger:"handover",basis:"balance",value:null}]});}
function offer() {return salesModelBase.shape.offers.element.parse({id:uid(20),name:"A101",unitId:uid(1),ownership:"freehold",price:1000000,currency:"THB",priceTaxTreatment:"unknown",status:"draft"});}

describe("unified sales model",()=>{
  it("starts with unknown project type and no fabricated license or terms",()=>{expect(salesModelSchema.parse(emptySalesModel()).licenses).toEqual([]);});
  it("supports condos, villas and mixed projects without fake villa floors",()=>{
    const m=emptySalesModel();m.projectType="villa";m.units=[{...unit(),kind:"villa",landArea:500}];expect(salesModelSchema.safeParse(m).success).toBe(true);
    m.units.push(unit(2));expect(salesModelSchema.safeParse(m).success).toBe(false);m.projectType="mixed";expect(salesModelSchema.safeParse(m).success).toBe(true);
  });
  it("rejects a building from another phase and dangling references",()=>{
    const m=emptySalesModel();m.units=[{...unit(),phaseId:uid(3),buildingId:uid(4)}];expect(salesModelSchema.safeParse(m).success).toBe(false);
    m.phases=[{id:uid(3),name:"Phase 1"},{id:uid(5),name:"Phase 2"}];m.buildings=[{id:uid(4),name:"B",phaseId:uid(5)}];expect(salesModelSchema.safeParse(m).success).toBe(false);
  });
  it("requires dated evidence for availability and license assertions",()=>{
    const m=emptySalesModel();m.units=[{...unit(),availability:"available"}];expect(salesModelSchema.safeParse(m).success).toBe(false);
    m.units=[];m.licenses=[salesModelBase.shape.licenses.element.parse({id:uid(3),name:"Hotel",kind:"hotel",status:"issued"})];expect(salesModelSchema.safeParse(m).success).toBe(false);
  });
  it("keeps ownership variants on one physical unit",()=>{
    const m=emptySalesModel();m.units=[unit()];m.offers=[offer(),{...offer(),id:uid(21),ownership:"leasehold"}];expect(salesModelSchema.safeParse(m).success).toBe(true);
  });
  it("rejects duplicate fee codes at the same scope",()=>{
    const m=emptySalesModel();m.fees=[fee(),fee(3)];expect(salesModelSchema.safeParse(m).success).toBe(false);
  });
  it("specific waived or unknown terms replace broader charges",()=>{
    const m=emptySalesModel();m.units=[unit()];const o=offer();m.fees=[fee(),{...fee(3),scope:"unit",scopeId:uid(1),treatment:"waived"}];
    expect(applicableFees(m,o)).toHaveLength(1);expect(applicableFees(m,o)[0].treatment).toBe("waived");
    m.fees[1].treatment="unknown";expect(feePreview(applicableFees(m,o)[0],unit(),1e6,"THB","2026-11-04")).toBeNull();
  });
  it("calculates monthly CAM and respects areas, tax and buyer share",()=>{
    expect(feePreview(fee(),{...unit(),totalArea:50},1e6,"THB","2026-11-04")).toBe(4250);
    expect(feePreview(fee(),unit(),1e6,"THB","2026-11-04")).toBeNull();
    expect(feePreview({...fee(),taxTreatment:"unknown"},{...unit(),totalArea:50},1e6,"THB","2026-11-04")).toBeNull();
    expect(feePreview({...fee(),payer:"shared",buyerSharePercent:50},{...unit(),totalArea:50},1e6,"THB","2026-11-04")).toBe(2125);
  });
  it("does not convert currency or treat expired terms as current",()=>{
    expect(feePreview({...fee(),basis:"percent_price",currency:"USD"},unit(),1e6,"THB","2026-11-04")).toBeNull();
    expect(feePreview({...fee(),validUntil:"2026-01-01"},{...unit(),totalArea:50},1e6,"THB","2026-11-04")).toBeNull();
  });
  it("credits deposit once, preserving the contract total",()=>{
    const p=plan();const r=paymentPreview(p,1e6,"THB");expect(r.error).toBeNull();expect(r.rows.map(x=>x.amount)).toEqual([100000,100000,800000]);expect(r.rows.reduce((s,r)=>s+r.amount,0)).toBe(1e6);
  });
  it("does not guess partial schedules, excess deposits, rates or currency",()=>{
    expect(paymentPreview({...plan(),completeness:"partial"},1e6,"THB").error).toBeTruthy();
    expect(paymentPreview({...plan(),depositAmount:300000},1e6,"THB").error).toBeTruthy();
    expect(paymentPreview({...plan(),interestIncluded:"extra",rateMethod:"variable"},1e6,"THB").error).toBeTruthy();
    expect(paymentPreview(plan(),1e6,"USD").error).toBeTruthy();
  });
  it("rejects complete schedules below or above 100 percent",()=>{
    const m=emptySalesModel();const p=plan();p.depositAmount=null;p.steps=p.steps.slice(0,1);m.paymentPlans=[p];expect(salesModelSchema.safeParse(m).success).toBe(false);
    p.steps[0].value=101;expect(salesModelSchema.safeParse(m).success).toBe(false);
  });
  it("rejects payment plans attached to a different unit",()=>{
    const m=emptySalesModel();m.units=[unit(),unit(2)];m.paymentPlans=[{...plan(),scope:"unit",scopeId:uid(2)}];m.offers=[{...offer(),paymentPlanId:uid(10)}];expect(salesModelSchema.safeParse(m).success).toBe(false);
  });
  it("form defaults preserve unknown numbers and currencies",()=>{
    const f=formDefault(salesFormSchema.properties!.fees.items!,"AED") as Record<string,unknown>;
    expect(f.amount).toBeNull();expect(f.currency).toBe("AED");expect(f.treatment).toBe("unknown");
  });
});
