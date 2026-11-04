import { z } from "zod";

// Versioned commercial specification. Physical identities remain project_units.id.
const id = z.string().uuid();
const text = z.string().trim().max(2000).default("");
const name = z.string().trim().min(1).max(200);
const date = z.union([z.iso.date(), z.literal("")]).default("");
const number = z.number().finite().nonnegative().max(1e12).nullable().default(null);
const currency = z.string().regex(/^[A-Z]{3}$/, "Укажите трёхбуквенный код валюты");
const evidence = {
  source: text, sourceDate: date, checkedOn: date,
  verification: z.enum(["unknown", "documented", "verified"]).default("unknown"),
};
const scope = {
  scope: z.enum(["project", "phase", "building", "unit", "offer"]).default("project"),
  scopeId: z.union([id, z.literal("")]).default(""),
};
const dated = { validFrom: date, validUntil: date, ...evidence };
const step = z.object({
  id, name, trigger: z.enum(["booking", "contract", "construction", "handover", "transfer", "date", "after_event", "other"]),
  triggerDetail: text, dueDate: date, daysAfter: z.number().int().nonnegative().max(36500).nullable().default(null),
  basis: z.enum(["percent_price", "fixed", "balance"]), value: number,
}).strict();
export const salesModelBase = z.object({
  version: z.literal(1),
  projectType: z.enum(["unknown", "condominium", "villa", "mixed"]),
  countryCode: z.union([z.string().regex(/^[A-Z]{2}$/), z.literal("")]),
  jurisdiction: text, defaultCurrency: currency, areaUnit: z.enum(["sqm", "sqft"]),
  developerLegalName: text, corporateGroup: text, brand: text,
  phases: z.array(z.object({ id, name }).strict()).max(100),
  buildings: z.array(z.object({ id, name, phaseId: z.union([id, z.literal("")]).default("") }).strict()).max(500),
  units: z.array(z.object({
    id, kind: z.enum(["apartment", "villa", "plot", "commercial"]),
    phaseId: z.union([id,z.literal("")]).default(""), buildingId: z.union([id,z.literal("")]).default(""),
    floorLabel: text, additionalFloors: text, plotNumber: text,
    internalArea: number, totalArea: number, landArea: number,
    availability: z.enum(["unknown", "available", "hold", "reserved", "sold", "withdrawn"]).default("unknown"),
    ...evidence,
  }).strict()).max(10000),
  licenses: z.array(z.object({
    id, ...scope, kind: z.enum(["hotel", "short_stay", "construction", "other"]), name,
    status: z.enum(["unknown", "not_issued", "applied", "issued", "expired", "revoked", "not_required"]),
    authority: text, holder: text, licenseNumber: text, permittedUse: text,
    ...dated,
  }).strict()).max(500),
  fees: z.array(z.object({
    id, ...scope, name, code: name,
    category: z.enum(["maintenance", "sinking_fund", "transfer", "tax", "registration", "utilities", "insurance", "management", "furniture", "other"]),
    treatment: z.enum(["unknown", "payable", "included", "waived", "not_applicable"]),
    mandatory: z.enum(["unknown", "required", "optional"]),
    basis: z.enum(["fixed", "per_internal_area", "per_total_area", "per_land_area", "percent_price"]),
    amount: number, currency,
    period: z.enum(["once", "month", "quarter", "year", "other"]),
    taxTreatment: z.enum(["unknown", "included", "excluded", "not_applicable"]), taxRate: number,
    payer: z.enum(["unknown", "buyer", "seller", "shared"]), buyerSharePercent: z.number().min(0).max(100).nullable().default(null),
    payableWhen: text, advanceMonths: z.number().int().nonnegative().max(120).nullable().default(null),
    notes: text, ...dated,
  }).strict()).max(2000),
  paymentPlans: z.array(z.object({
    id, ...scope, name, currency,
    financing: z.enum(["cash", "construction_installments", "post_handover_installments", "developer_loan", "bank_mortgage", "other"]),
    lender: text, eligibility: text, approval: z.enum(["unknown", "required", "not_required"]),
    durationMonths: z.number().int().positive().max(1200).nullable().default(null),
    annualRate: number, rateMethod: z.enum(["unknown", "interest_free", "flat", "reducing_balance", "variable"]),
    interestIncluded: z.enum(["unknown", "included", "extra"]), financingFees: text,
    depositAmount: number,
    depositTreatment: z.enum(["unknown", "not_applicable", "credited_to_price", "additional_fee", "refundable_security"]),
    depositRefund: z.enum(["unknown", "refundable", "non_refundable", "conditional"]),
    depositRefundTerms: text, depositDue: text, depositPayee: text,
    depositCreditStepId: z.union([id,z.literal("")]).default(""),
    reservationDays: z.number().int().positive().max(3650).nullable().default(null),
    paymentMethod: text, escrow: z.enum(["unknown", "yes", "no"]), escrowTerms: text,
    completeness: z.enum(["partial", "complete"]), notes: text, ...dated,
    steps: z.array(step).max(240),
  }).strict()).max(500),
  offers: z.array(z.object({
    id, name, unitId: id, seller: text,
    ownership: z.enum(["unknown", "freehold", "leasehold", "other"]), ownershipDetail: text,
    tenureYears: z.number().positive().max(1000).nullable().default(null),
    fitout: text, furniture: text, price: number, currency,
    priceTaxTreatment: z.enum(["unknown", "included", "excluded", "not_applicable"]),
    status: z.enum(["draft", "offered", "withdrawn"]), paymentPlanId: z.union([id,z.literal("")]).default(""),
    ...dated,
  }).strict()).max(10000),
}).strict();

export type SalesModel = z.infer<typeof salesModelBase>;
export type Fee = SalesModel["fees"][number];
export type PaymentPlan = SalesModel["paymentPlans"][number];

export const salesModelSchema = salesModelBase.superRefine((m, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const ids = new Set<string>();
  for (const key of ["phases", "buildings", "units", "licenses", "fees", "paymentPlans", "offers"] as const) {
    m[key].forEach((r, i) => { if (ids.has(r.id)) issue([key,i,"id"], "Повторяющийся идентификатор"); ids.add(r.id); });
  }
  const phases = new Set(m.phases.map(x=>x.id)), buildings = new Map(m.buildings.map(x=>[x.id,x]));
  const units = new Map(m.units.map(x=>[x.id,x])), offers = new Map(m.offers.map(x=>[x.id,x]));
  const plans = new Map(m.paymentPlans.map(x=>[x.id,x]));
  m.buildings.forEach((b,i)=> { if(b.phaseId && !phases.has(b.phaseId)) issue(["buildings",i,"phaseId"],"Очередь не существует"); });
  m.units.forEach((u,i)=> {
    if(u.phaseId && !phases.has(u.phaseId)) issue(["units",i,"phaseId"],"Очередь не существует");
    if(u.buildingId && !buildings.has(u.buildingId)) issue(["units",i,"buildingId"],"Корпус не существует");
    const b = buildings.get(u.buildingId);
    if(b && u.phaseId && b.phaseId !== u.phaseId) issue(["units",i,"phaseId"],"Очередь не совпадает с очередью корпуса");
    if(m.projectType === "condominium" && u.kind !== "apartment" && u.kind !== "commercial") issue(["units",i,"kind"],"Для вилл выберите вилловый или смешанный проект");
    if(m.projectType === "villa" && u.kind === "apartment") issue(["units",i,"kind"],"Для квартир выберите кондоминиум или смешанный проект");
    if(u.availability !== "unknown" && (!u.source || !u.sourceDate)) issue(["units",i,"source"],"Для статуса нужны источник и дата");
    if(u.verification !== "unknown" && (!u.source || !u.sourceDate)) issue(["units",i,"source"],"Нужен датированный источник");
    if(u.verification === "verified" && !u.checkedOn) issue(["units",i,"checkedOn"],"Нужна дата проверки");
  });
  for(const key of ["licenses","fees","paymentPlans"] as const) m[key].forEach((r,i)=> {
    const valid = r.scope === "project" ? !r.scopeId : r.scope === "phase" ? phases.has(r.scopeId) : r.scope === "building" ? buildings.has(r.scopeId) : r.scope === "unit" ? units.has(r.scopeId) : offers.has(r.scopeId);
    if(!valid) issue([key,i,"scopeId"],"Выберите существующий объект соответствующего уровня");
  });
  for(const key of ["licenses","fees","paymentPlans","offers"] as const) m[key].forEach((r,i)=> {
    if(r.validFrom && r.validUntil && r.validUntil < r.validFrom) issue([key,i,"validUntil"],"Конец периода раньше начала");
    if(r.verification !== "unknown" && (!r.source || !r.sourceDate)) issue([key,i,"source"],"Нужны источник и дата документа");
    if(r.verification === "verified" && !r.checkedOn) issue([key,i,"checkedOn"],"Укажите дату проверки");
  });
  m.licenses.forEach((l,i)=> {
    if(l.status !== "unknown" && (!l.source || !l.sourceDate)) issue(["licenses",i,"source"],"Статус лицензии требует источника и даты");
    if(l.status === "issued" && (!l.authority || !l.holder || !l.licenseNumber || !l.permittedUse)) issue(["licenses",i,"licenseNumber"],"Для выданной лицензии нужны номер, орган, держатель и область действия");
  });
  const feeKeys = new Set<string>();
  m.fees.forEach((f,i)=> {
    const k = [f.scope,f.scopeId,f.code].join(":");
    if(feeKeys.has(k)) issue(["fees",i,"code"],"Дублирующий код сбора на одном уровне; сохраняйте историю через версии"); feeKeys.add(k);
    if(f.treatment === "payable" && f.amount === null) issue(["fees",i,"amount"],"Укажите сумму или оставьте условие неизвестным");
    if(f.basis === "percent_price" && f.amount !== null && f.amount > 100) issue(["fees",i,"amount"],"Процент не должен превышать 100");
    if(f.payer === "shared" && f.buyerSharePercent === null) issue(["fees",i,"buyerSharePercent"],"Укажите долю покупателя");
    if(f.taxRate !== null && f.taxRate > 100) issue(["fees",i,"taxRate"],"Ставка не должна превышать 100%");
  });
  m.paymentPlans.forEach((p,i)=> {
    const seen = new Set<string>();
    p.steps.forEach((s,j)=> {
      if(seen.has(s.id)) issue(["paymentPlans",i,"steps",j,"id"],"Повторяющийся этап"); seen.add(s.id);
      if(s.basis !== "balance" && s.value === null) issue(["paymentPlans",i,"steps",j,"value"],"Укажите сумму или процент");
      if(s.basis === "balance" && s.value !== null) issue(["paymentPlans",i,"steps",j,"value"],"Остаток рассчитывается, оставьте сумму пустой");
      if(s.basis === "percent_price" && (s.value ?? 0) > 100) issue(["paymentPlans",i,"steps",j,"value"],"Процент больше 100");
      if(s.trigger === "date" && !s.dueDate) issue(["paymentPlans",i,"steps",j,"dueDate"],"Укажите дату платежа");
      if(s.trigger === "after_event" && (s.daysAfter === null || !s.triggerDetail)) issue(["paymentPlans",i,"steps",j,"daysAfter"],"Нужны событие и количество дней");
    });
    const balances = p.steps.filter(s=>s.basis === "balance");
    if(balances.length > 1 || (balances.length && p.steps.at(-1)?.basis !== "balance")) issue(["paymentPlans",i,"steps"],"Остаток может быть только последним и единственным");
    const percent = p.steps.filter(s=>s.basis === "percent_price").reduce((a,s)=>a+(s.value ?? 0),0);
    if(percent > 100.000001) issue(["paymentPlans",i,"steps"],"Этапы превышают 100% цены");
    if(p.completeness === "complete" && (!p.steps.length || (!balances.length && p.steps.every(s=>s.basis === "percent_price") && Math.abs(percent-100)>0.000001))) issue(["paymentPlans",i,"steps"],"Полный процентный график должен покрывать 100% цены");
    if(p.depositAmount !== null && p.depositTreatment === "credited_to_price" && !p.steps.some(s=>s.id === p.depositCreditStepId)) issue(["paymentPlans",i,"depositCreditStepId"],"Выберите этап, из которого вычитается депозит");
    if(p.depositTreatment === "not_applicable" && p.depositAmount !== null && p.depositAmount !== 0) issue(["paymentPlans",i,"depositAmount"],"Если депозит не применяется, сумма должна быть пустой или нулевой");
    if(p.rateMethod === "interest_free" && p.annualRate !== 0) issue(["paymentPlans",i,"annualRate"],"Беспроцентный план: ставка должна быть явно равна 0");
  });
  m.offers.forEach((o,i)=> {
    if(!units.has(o.unitId)) issue(["offers",i,"unitId"],"Добавьте расположение этого юнита");
    const p = plans.get(o.paymentPlanId);
    if(o.paymentPlanId && !p) issue(["offers",i,"paymentPlanId"],"План оплаты не существует");
    if(p && (p.currency !== o.currency || !scopeApplies(m,p,o))) issue(["offers",i,"paymentPlanId"],"План не подходит по валюте или области действия");
    if(o.status === "offered" && (o.price === null || !o.source || !o.sourceDate)) issue(["offers",i,"price"],"Для предложения нужны цена, источник и дата");
  });
});

export function emptySalesModel(): SalesModel {
  return salesModelBase.parse({ version:1, projectType:"unknown", countryCode:"", defaultCurrency:"THB", areaUnit:"sqm", phases:[], buildings:[], units:[], licenses:[], fees:[], paymentPlans:[], offers:[] });
}

export function scopeApplies(m: SalesModel, s: {scope: string; scopeId: string}, o: SalesModel["offers"][number]) {
  const u=m.units.find(x=>x.id===o.unitId), b=m.buildings.find(x=>x.id===u?.buildingId);
  return s.scope === "project" || (s.scope === "offer" && s.scopeId === o.id) || (s.scope === "unit" && s.scopeId === o.unitId) || (s.scope === "building" && !!u?.buildingId && s.scopeId === u.buildingId) || (s.scope === "phase" && !!(u?.phaseId || b?.phaseId) && s.scopeId === (u?.phaseId || b?.phaseId));
}

/** Same code replaces broader terms, including unknown/waived overrides. Never sum both. */
export function applicableFees(m: SalesModel, offer: SalesModel["offers"][number]): Fee[] {
  const rank = {project:0,phase:1,building:2,unit:3,offer:4};
  const selected = new Map<string,Fee>();
  for(const f of m.fees.filter(f=>scopeApplies(m,f,offer)).sort((a,b)=>rank[a.scope]-rank[b.scope])) selected.set(f.code,f);
  return [...selected.values()];
}

/** Preview only. No FX, financing-interest or jurisdictional tax assumptions. */
export function feePreview(f: Fee, u: SalesModel["units"][number], price: number|null, priceCurrency: string, asOf: string): number|null {
  if((f.validFrom && asOf < f.validFrom) || (f.validUntil && asOf > f.validUntil)) return null;
  if(["included","waived","not_applicable"].includes(f.treatment)) return 0;
  if(f.treatment !== "payable" || f.amount === null || f.payer === "unknown" || f.taxTreatment === "unknown") return null;
  const base=f.basis === "fixed" ? 1 : f.basis === "per_internal_area" ? u.internalArea : f.basis === "per_total_area" ? u.totalArea : f.basis === "per_land_area" ? u.landArea : (f.currency === priceCurrency && price !== null ? price/100 : null);
  if(base === null) return null;
  if(f.taxTreatment === "excluded" && f.taxRate === null) return null;
  const share=f.payer === "seller" ? 0 : f.payer === "shared" ? f.buyerSharePercent === null ? null : f.buyerSharePercent/100 : 1;
  if(share === null) return null;
  return f.amount * base * share * (f.taxTreatment === "excluded" ? 1+(f.taxRate ?? 0)/100 : 1);
}

export function paymentPreview(p: PaymentPlan, price: number, priceCurrency: string, asOf?: string) {
  if(asOf && ((p.validFrom && asOf < p.validFrom) || (p.validUntil && asOf > p.validUntil))) return {error:"График не действует на выбранную дату", rows:[]};
  if(p.currency !== priceCurrency || p.completeness !== "complete" || p.interestIncluded === "unknown" || (p.interestIncluded === "extra" && p.rateMethod !== "interest_free")) return {error:"Нужен полный график в валюте предложения с определёнными процентами", rows:[]};
  if(p.depositTreatment === "unknown" || (p.depositTreatment !== "not_applicable" && p.depositAmount === null)) return {error:"Не определены сумма или зачёт депозита",rows:[]};
  let allocated=0;
  const rows=p.steps.map(s=>{ const amount=s.basis === "balance" ? price-allocated : s.basis === "percent_price" ? price*(s.value ?? 0)/100 : s.value ?? 0; allocated+=amount; return {id:s.id,name:s.name,amount}; });
  if(rows.some(r=>r.amount<0) || Math.abs(allocated-price)>0.01) return {error:"График не совпадает с ценой предложения",rows:[]};
  if(p.depositAmount !== null) {
    if(p.depositTreatment === "credited_to_price") {
      const row=rows.find(r=>r.id===p.depositCreditStepId);
      if(!row || row.amount<p.depositAmount) return {error:"Депозит превышает платёж этапа зачёта",rows:[]};
      row.amount-=p.depositAmount;
    }
    rows.unshift({id:"deposit",name:p.depositTreatment === "refundable_security" ? "Возвратное обеспечение (отдельно от цены)" : "Депозит",amount:p.depositAmount});
  }
  return {error:null,rows};
}
