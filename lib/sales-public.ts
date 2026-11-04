import { applicableFees,feePreview,paymentPreview,scopeApplies,type SalesModel } from "./sales-model";
import { freshnessOf } from "./inventory/freshness";

export type PublicUnitIdentity={id:string;label:string;status:string;bedrooms?:number|null};
export function publicSalesProjection(model:SalesModel,revision:number,units:PublicUnitIdentity[],today:string) {
  const valid=(r:{validFrom:string;validUntil:string})=>(!r.validFrom||r.validFrom<=today)&&(!r.validUntil||r.validUntil>=today);
  const recent=(d:string)=>freshnessOf(d,Date.parse(`${today}T00:00:00Z`))!=="expired";
  const offers=model.offers.flatMap(o=>{
    const u=model.units.find(u=>u.id===o.unitId),identity=units.find(u=>u.id===o.unitId);
    if(!u||!identity||["sold","reserved"].includes(identity.status)||u.availability!=="available"||o.status!=="offered"||o.price===null||!valid(o)||!recent(o.sourceDate)||!recent(u.sourceDate)) return [];
    const building=model.buildings.find(b=>b.id===u.buildingId),phase=model.phases.find(p=>p.id===(u.phaseId||building?.phaseId));
    const p=model.paymentPlans.find(p=>p.id===o.paymentPlanId);
    const plan=p&&valid(p)?p:null;
    const schedule=plan?paymentPreview(plan,o.price,o.currency,today):null;
    return [{
      id:o.id,unitId:u.id,revision,name:o.name,label:identity.label,kind:u.kind,phase:phase?.name??"",building:building?.name??"",floor:u.floorLabel,plot:u.plotNumber,
      bedrooms:identity.bedrooms??null,totalArea:u.totalArea,internalArea:u.internalArea,landArea:u.landArea,areaUnit:model.areaUnit,
      price:o.price,currency:o.currency,priceDate:o.sourceDate,availabilityDate:u.sourceDate,validUntil:o.validUntil,
      ownership:o.ownership,ownershipDetail:o.ownershipDetail,tenureYears:o.tenureYears,fitout:o.fitout,furniture:o.furniture,priceTaxTreatment:o.priceTaxTreatment,
      fees:applicableFees(model,o).map(f=>({id:f.id,name:f.name,period:f.period,currency:f.currency,mandatory:f.mandatory,treatment:f.treatment,advanceMonths:f.advanceMonths,payableWhen:f.payableWhen,amount:feePreview(f,u,o.price,o.currency,today),sourceDate:f.sourceDate})),
      payment:plan?{name:plan.name,currency:plan.currency,financing:plan.financing,eligibility:plan.eligibility,approval:plan.approval,durationMonths:plan.durationMonths,annualRate:plan.annualRate,rateMethod:plan.rateMethod,interestIncluded:plan.interestIncluded,financingFees:plan.financingFees,depositAmount:plan.depositAmount,depositTreatment:plan.depositTreatment,depositRefund:plan.depositRefund,depositRefundTerms:plan.depositRefundTerms,depositDue:plan.depositDue,reservationDays:plan.reservationDays,escrow:plan.escrow,escrowTerms:plan.escrowTerms,sourceDate:plan.sourceDate,error:schedule?.error??null,rows:schedule?.rows.map(r=>{const step=plan.steps.find(s=>s.id===r.id);return {...r,trigger:step?.trigger??"booking",triggerDetail:step?.triggerDetail??"",dueDate:step?.dueDate??"",daysAfter:step?.daysAfter??null};})??[]}:null,
      licenses:model.licenses.filter(l=>scopeApplies(model,l,o)).map(l=>({name:l.name,kind:l.kind,status:l.validUntil&&l.validUntil<today?"expired":l.validFrom&&l.validFrom>today?"unknown":l.status,scope:l.scope,authority:l.authority,licenseNumber:l.licenseNumber,permittedUse:l.permittedUse,validUntil:l.validUntil,sourceDate:l.sourceDate,verification:l.verification})),
    }];
  });
  return {revision,offers};
}
export type PublicSales=ReturnType<typeof publicSalesProjection> & {expiresAt?:string};
export type PublicOffer=PublicSales["offers"][number];
