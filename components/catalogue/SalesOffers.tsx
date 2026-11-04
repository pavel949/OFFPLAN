"use client";
import { floorLabel, offerDetail } from "@/lib/buyer-display";
import {usePublicationExpired} from "../ie/usePublicationExpired";
import {useState} from "react";
import type {PublicSales,PublicOffer} from "@/lib/sales-public";
import {optionLabels} from "@/lib/sales-form";
import {LeadModal} from "./LeadModal";

export function SalesOffers({sales:initialSales,projectId,projectName,lang}:{sales:PublicSales;projectId:number;projectName:string;lang:"ru"|"en"}) {
  const expired=usePublicationExpired(initialSales.expiresAt);
  const sales=expired?{...initialSales,offers:[]}:initialSales;
  const ru=lang==="ru",t=(r:string,e:string)=>ru?r:e;
  const label=(v:string)=>ru?(optionLabels[v]??v):v.replaceAll("_"," ");
  const [phase,setPhase]=useState(""),[building,setBuilding]=useState(""),[floor,setFloor]=useState("");
  const [ownership,setOwnership]=useState(""),[bedrooms,setBedrooms]=useState(""),[budget,setBudget]=useState("");
  const [selected,setSelected]=useState<PublicOffer|null>(null),[limit,setLimit]=useState(30);
  const visible=sales.offers.filter(o=>(!phase||o.phase===phase)&&(!building||o.building===building)&&(!floor||o.floor===floor)&&(!ownership||o.ownership===ownership)&&(!bedrooms||o.bedrooms===Number(bedrooms))&&(!budget||(o.currency==="THB"&&o.price<=Number(budget)*1e6)));
  const uniqueUnits = new Map(visible.map(o=>[o.unitId,o]));
  const money=(v:number|null,c:string)=>v===null?t("Уточняется","To be confirmed"):`${v.toLocaleString(ru?"ru-RU":"en-GB",{maximumFractionDigits:2})} ${c}`;
  return <section className="ie-card" id="unit-offers"><h2 className="ie-h2">{t("Выбрать юнит и условия покупки","Choose a unit and purchase terms")}</h2>
    {sales.offers.length ? <p className="ie-small">{new Set(sales.offers.map(o=>o.unitId)).size} {t("лотов в опубликованном прайсе. Набор может быть неполным.","units in the published price list. Coverage may be partial.")} {t("Наличие по данным на","Availability observed on")} {sales.offers.map(o=>o.availabilityDate).sort()[0]}.</p> : null}
    <p className="ie-small">{t("Наличие и цена указаны по датам источников. Отправка запроса не является бронированием и не требует платежа.","Availability and prices are dated. Sending an inquiry does not reserve the unit or require a payment.")}</p>
    {sales.offers.length ? <div className="ie-unit-filters">
      <label> {t("Бюджет, до млн ฿","Budget, up to THB million")}<input aria-label={t("Бюджет, до млн ฿","Budget, up to THB million")} type="number" min="0" step="0.1" value={budget} onChange={e=>{setBudget(e.target.value);setLimit(30);}} placeholder={t("Любой","Any")}/></label>
      <label>{t("Спальни","Bedrooms")}<select aria-label={t("Спальни","Bedrooms")} value={bedrooms} onChange={e=>{setBedrooms(e.target.value);setLimit(30);}}><option value="">{t("Любые","Any")}</option>{[...new Set(sales.offers.flatMap(o=>o.bedrooms==null?[]:[o.bedrooms]))].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{n===0?t("Студия","Studio"):n}</option>)}</select></label>
      <label>{t("Владение","Ownership")}<select aria-label={t("Владение","Ownership")} value={ownership} onChange={e=>{setOwnership(e.target.value);setLimit(30);}}><option value="">{t("Любое","Any")}</option>{[...new Set(sales.offers.map(o=>o.ownership))].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label>
    </div> : null}
    {sales.offers.length?<div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"16px 0"}}>{([['phase',phase,setPhase],['building',building,setBuilding],['floor',floor,setFloor]] as const).map(([key,value,set])=><label key={key}>{key==="phase"?t("Очередь","Phase"):key==="building"?t("Корпус","Building"):t("Этаж","Floor")} <select value={value} onChange={e=>{set(e.target.value);setLimit(30);}}><option value="">{t("Все","All")}</option>{[...new Set(sales.offers.map(o=>o[key]).filter(Boolean))].sort().map(v=><option key={v} value={v}>{key==="floor"?floorLabel(v,lang):v}</option>)}</select></label>)}</div>:null}
    {!visible.length?<p>{t("Сейчас нет опубликованных актуальных предложений. Запросите наличие у команды проекта.","No current published offers. Ask the project team for availability.")}</p>:null}
    {sales.offers.length ? <p aria-live="polite">{uniqueUnits.size} {t("юнитов по фильтрам","units matching filters")} · {visible.length} {t("вариантов покупки (разные формы владения одного юнита не являются разными квартирами)","purchase options (ownership alternatives are the same physical unit)")}</p> : null}
    {[...uniqueUnits.values()].slice(0,limit).map(unit=><div key={unit.unitId} className="ie-unit-group"><h3>{unit.label} · {unit.bedrooms==null?t("Спальни уточняются","Bedrooms unconfirmed"):`${unit.bedrooms} ${t("спал.","bedrooms")}`} · {unit.totalArea??"—"} {label(unit.areaUnit)}</h3>
      <p className="ie-small">{t("Подтверждённые фото и планировка именно этого юнита пока не добавлены. Материалы комплекса доступны в разделе ниже.","Verified photos and a floor plan for this exact unit have not been added. Development materials are available below.")} <a href="#project-materials">{t("Материалы проекта","Project materials")}</a></p>
      {visible.filter(o=>o.unitId===unit.unitId).map(o=><details key={o.id} style={{borderTop:"1px solid var(--line)",padding:"16px 0"}}><summary style={{cursor:"pointer"}}><b>{o.label}</b> · {[o.phase,o.building,o.floor?`${t("этаж по источнику","source floor")} ${floorLabel(o.floor,lang)}`:o.plot].filter(Boolean).join(" · ")} · <b>{money(o.price,o.currency)}</b> · {label(o.ownership)}</summary>
      <p>{offerDetail(o.ownershipDetail,lang)} {o.tenureYears?`${o.tenureYears} ${t("лет","years")}`:""}</p><p>{offerDetail(o.fitout,lang)} {offerDetail(o.furniture,lang)}</p>
      <p className="ie-small">{t("Цена на","Price dated")} {o.priceDate}; {t("наличие от","availability dated")} {o.availabilityDate}. {t("Налоги в цене","Price taxes")}: {label(o.priceTaxTreatment)}.</p>
      <h3>{t("Расходы покупателя","Buyer costs")}</h3>
      {!o.fees.length?<p>{t("Расходы ещё не внесены. Это не означает, что их нет.","Costs have not been provided; this does not mean there are none.")}</p>:<ul>{o.fees.map(f=><li key={f.id}>{f.name}: {money(f.amount,f.currency)} · {label(f.period)} · {label(f.mandatory)}{f.advanceMonths!==null?` · ${t("аванс, месяцев","advance months")}: ${f.advanceMonths}`:""}. {f.payableWhen} {f.sourceDate?`(${f.sourceDate})`:""}</li>)}</ul>}
      <h3>{t("Порядок оплаты","Payment terms")}</h3>
      {o.payment?<><p>{o.payment.name} · {label(o.payment.financing)}. {o.payment.durationMonths?`${o.payment.durationMonths} ${t("мес.","months")}`:""} {o.payment.annualRate===null?t("Ставка уточняется","Rate to be confirmed"):`${o.payment.annualRate}%`} · {label(o.payment.rateMethod)}</p><p>{o.payment.eligibility} · {t("Одобрение","Approval")}: {label(o.payment.approval)}. {o.payment.financingFees}</p><p>{t("Депозит","Deposit")}: {money(o.payment.depositAmount,o.payment.currency)} · {label(o.payment.depositTreatment)} · {label(o.payment.depositRefund)}. {o.payment.depositRefundTerms} {o.payment.depositDue}</p>
        {o.payment.error?<p>{t("Полный расчёт платежей требует уточнения.","A complete payment calculation requires confirmation.")}</p>:<ol>{o.payment.rows.map(r=><li key={r.id}>{r.name}: {money(r.amount,o.payment!.currency)} · {label(r.trigger)} {r.triggerDetail} {r.dueDate} {r.daysAfter!==null?`+${r.daysAfter} ${t("дней","days")}`:""}</li>)}</ol>}
        <p className="ie-small">{t("Эскроу","Escrow")}: {label(o.payment.escrow)}. {o.payment.escrowTerms}</p></>:<p>{t("График оплаты уточняется","Payment schedule to be confirmed")}</p>}
      <h3>{t("Лицензии и область действия","Licenses and scope")}</h3>{!o.licenses.length?<p>{t("Подтверждённые сведения не внесены","No documented information provided")}</p>:<ul>{o.licenses.map((l,i)=><li key={i}>{l.name}: {label(l.status)} · {label(l.scope)} · {label(l.verification)}. {l.permittedUse} {l.licenseNumber} {l.validUntil?`${t("до","until")} ${l.validUntil}`:""}</li>)}</ul>}
      <p className="ie-small">{t("Лицензия отдельного отеля не подтверждает право краткосрочной сдачи каждой квартиры комплекса.","A hotel license does not establish short-stay rights for every apartment in the development.")}</p>
      <button className="ie-btn ie-btn-primary" type="button" onClick={()=>setSelected(o)}>{t("Запросить этот юнит","Enquire about this unit")}</button>
    </details>)} </div>)}
    {uniqueUnits.size>limit?<button type="button" className="ie-btn" onClick={()=>setLimit(v=>v+30)}>{t("Показать ещё","Show more")}</button>:null}
    {selected && !expired?<LeadModal key={`${selected.id}:${selected.revision}`} open onClose={()=>setSelected(null)} lang={lang} projectId={projectId} projectName={projectName} offerId={selected.id} salesRevision={selected.revision} unitLabel={selected.label} selection={selected}/>:null}
  </section>;
}
