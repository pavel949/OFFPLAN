"use client";

import { useEffect, useState } from "react";
import { adminSaveSalesModel,adminPublishSalesModel,adminWithdrawSalesModel } from "@/app/actions/sales-model";
import { partnerSaveSalesModel, partnerCreateSalesUnit } from "@/app/actions/partner-sales";
import { publicSalesProjection } from "@/lib/sales-public";
import { adminStudioSaveUnit } from "@/app/actions/admin-studio";
import { applicableFees, feePreview, paymentPreview, type SalesModel } from "@/lib/sales-model";
import { fieldLabels, optionLabels, salesFormSchema, schemaType, formDefault, type FormSchema } from "@/lib/sales-form";

type Row = Record<string,unknown>;
type Option = {id:string;name:string};
const sections = ["phases","buildings","units","licenses","fees","paymentPlans","offers"] as const;
const hints: Record<string,string> = {
  phases:"Необязательно. Очередь — этап проекта, корпус — физическое здание.",
  buildings:"Для вилл корпус можно не создавать. Смешанный проект использует общие очереди и разные типы юнитов.",
  units:"Выберите существующий юнит из «Лоты и цены». Площади здесь выражаются в единице площади этой модели. Пустое значение означает, что данных нет.",
  licenses:"Отельный бренд не подтверждает лицензию. Укажите точную область действия: проект, корпус или юнит. Отсутствие документа означает «неизвестно», а не «лицензии нет».",
  fees:"Один код сбора: предложение → юнит → корпус → очередь → проект. Более точное условие заменяет общее, не прибавляется к нему. Разные сборы должны иметь разные коды. Налоги и ставки из страны автоматически не подставляются.",
  paymentPlans:"График описывает обязательства покупателя, а не факт получения денег. Депозит указывается отдельно и вычитается из выбранного этапа, если засчитывается в цену. Фрагменты прайса сохраняйте как неполный график.",
  offers:"Один физический юнит может иметь несколько вариантов владения, комплектации и оплаты. Это внутренние условия: сохранение не публикует их на сайте.",
};

export function SalesModelEditor({projectId,initial,initialRevision,units:initialUnits,initialPublication,mode="admin"}:{mode?:"admin"|"partner";projectId:string;initial:SalesModel;initialRevision:number;units:{id:string;label:string;status?:string;bedrooms?:number|null}[];initialPublication:{revision:number;expires_at:string}|null}) {
  const [units,setUnits]=useState(initialUnits),[newUnit,setNewUnit]=useState("");
  const [publication,setPublication]=useState(initialPublication),[until,setUntil]=useState("");
  const [approved,setApproved]=useState(false);
  const [model,setModel]=useState(initial), [revision,setRevision]=useState(initialRevision);
  const [dirty,setDirty]=useState(false), [busy,setBusy]=useState(false), [message,setMessage]=useState("");
  const [offerId,setOfferId]=useState("");
  useEffect(()=> {
    const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",warn); return ()=>window.removeEventListener("beforeunload",warn);
  },[dirty]);
  function change(key:string,value:unknown) { setModel(m=>({...m,[key]:value})); setDirty(true);setMessage(""); }
  function options(key:string,row:Row,section:string): Option[]|null {
    if(key === "phaseId") return model.phases;
    if(key === "buildingId") return model.buildings;
    if(key === "unitId" || (key === "id" && section === "units")) return units.map(u=>({id:u.id,name:u.label}));
    if(key === "paymentPlanId") return model.paymentPlans;
    if(key === "depositCreditStepId") return (row.steps as Option[]|undefined) ?? [];
    if(key === "scopeId") return row.scope === "phase" ? model.phases : row.scope === "building" ? model.buildings : row.scope === "unit" ? model.units.map(u=>({id:u.id,name:units.find(x=>x.id===u.id)?.label ?? u.id})) : row.scope === "offer" ? model.offers : [];
    return null;
  }
  function fields(schema:FormSchema,row:Row,onChange:(r:Row)=>void,section:string) {
    return <div className="adm-grid">{Object.entries(schema.properties ?? {}).filter(([k])=> k!=="version" && (k!=="id" || section === "units")).map(([key,s])=> {
      if(schemaType(s) === "array") return <div className="c12" key={key}>{rows(s,(row[key] as Row[]) ?? [],v=>onChange({...row,[key]:v}),key)}</div>;
      const opts=options(key,row,section), value=row[key], nullable=(Array.isArray(s.type)&&s.type.includes("null")) || s.anyOf?.some(v=>v.type==="null");
      const numeric=["number","integer"].includes(schemaType(s));
      const isDate=s.format === "date" || s.anyOf?.some(v=>v.format === "date");
      const update=(v:unknown)=>onChange({...row,[key]:v,...(key==="scope"?{scopeId:""}:{})});
      return <label className="c6" key={key} style={{display:"grid",gap:4,marginBottom:12}}><span>{fieldLabels[key] ?? key}</span>
        {opts ? <select value={String(value ?? "")} onChange={e=>update(e.target.value)} disabled={key==="scopeId"&&row.scope==="project"}>
          <option value="">{key==="scopeId"&&row.scope==="project"?"Весь проект":"Не выбрано"}</option>
          {opts.map(o=><option key={o.id} value={o.id}>{o.name || "Без названия"}</option>)}
        </select> : s.enum ? <select value={String(value ?? "")} onChange={e=>update(e.target.value)}>{s.enum.map(v=><option key={v} value={v}>{optionLabels[v] ?? v}</option>)}</select>
        : <input value={value === null || value === undefined ? "" : String(value)} type={numeric?"number":isDate?"date":"text"} step={numeric?"any":undefined} min={numeric?0:undefined} maxLength={numeric?undefined:2000} onChange={e=>update(numeric ? e.target.value==="" && nullable ? null : e.target.value==="" ? null : Number(e.target.value) : e.target.value)} />}
      </label>;
    })}</div>;
  }
  function rows(schema:FormSchema,values:Row[],onChange:(r:Row[])=>void,section:string) {
    return <div><h3>{fieldLabels[section]}</h3>{hints[section] && <p className="adm-lead">{hints[section]}</p>}
      {values.map((r,i)=><details key={String(r.id)} className="adm-card">
        <summary>{i+1}. {String(r.name || (section==="units"?units.find(u=>u.id===r.id)?.label:"") || "Новая запись")}</summary>
        <div style={{marginTop:16}}>{fields(schema.items ?? {},r,next=>onChange(values.map((v,j)=>j===i?next:v)),section)}</div>
        <button type="button" onClick={()=>onChange(values.filter((_,j)=>j!==i))}>Убрать из текущей версии</button>
        {section==="steps" && i>0 ? <button type="button" onClick={()=>{const next=[...values];[next[i-1],next[i]]=[next[i],next[i-1]];onChange(next);}}>↑ Раньше</button>:null}
        {section==="steps" && i<values.length-1 ? <button type="button" onClick={()=>{const next=[...values];[next[i+1],next[i]]=[next[i],next[i+1]];onChange(next);}}>↓ Позже</button>:null}
      </details>)}
      <button type="button" onClick={()=>{ const next=formDefault(schema.items ?? {},model.defaultCurrency) as Row; if(section==="units"){next.id="";next.kind=model.projectType==="villa"?"villa":"apartment";} onChange([...values,next]); }}>+ Добавить</button>
    </div>;
  }
  const offer=model.offers.find(o=>o.id===offerId), unit=model.units.find(u=>u.id===offer?.unitId), plan=model.paymentPlans.find(p=>p.id===offer?.paymentPlanId);
  const preview=plan && offer?.price!==null && offer?.price!==undefined ? paymentPreview(plan,offer.price,offer.currency,new Date().toISOString().slice(0,10)):null;
  return <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await (mode==="partner" ? partnerSaveSalesModel : adminSaveSalesModel)(projectId,revision,model);if(r.ok && r.revision){setRevision(r.revision);setDirty(false);setMessage((mode==="partner"?"Отправлено команде IE на проверку. Покупатели пока видят прежнюю опубликованную версию. Новая версия ":"Сохранено. Внутренняя версия ")+r.revision);}else setMessage(r.error ?? "Ошибка сохранения");}catch{setMessage("Ошибка соединения. Изменения остались в форме.");}finally{setBusy(false);}}}>
    <section className="adm-card"><h2>Структура и условия продажи</h2><p className="adm-lead">Единая модель для квартир, вилл и смешанных проектов. Версия {revision || "ещё не сохранена"}. Сохранение создаёт внутреннюю версию. {mode==="partner"?"Команда IE проверяет и отдельно публикует её. Внутренние источники IE скрыты; изменённые факты требуют вашего датированного источника.":"Публикация — отдельный шаг ниже."}</p>
      <label>Новый физический юнит <input value={newUnit} onChange={e=>setNewUnit(e.target.value)} placeholder="Например: B-504 или Villa 8" /></label>{" "}
      <button type="button" disabled={busy||!newUnit.trim()} onClick={async()=>{setBusy(true);try{const r=await (mode==="partner" ? partnerCreateSalesUnit(projectId,newUnit) : adminStudioSaveUnit(projectId,{label:newUnit,bedrooms:null,floor:null,sqm:null,price:null,status:"unknown"}));if(r.ok&&r.id){setUnits(u=>[...u,{id:r.id!,label:newUnit.trim()}]);setNewUnit("");setMessage("Юнит создан. Добавьте его расположение и предложение ниже.");}else setMessage(r.error??"Ошибка");}finally{setBusy(false);}}}>Создать юнит</button>
    </section>
    <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
      <section className="adm-card"><h3>Проект и география</h3>{fields({...salesFormSchema,properties:Object.fromEntries(Object.entries(salesFormSchema.properties ?? {}).filter(([k])=>!sections.includes(k as typeof sections[number])))},model as unknown as Row,r=>{setModel(r as unknown as SalesModel);setDirty(true);},"project")}</section>
      {sections.map(key=><section className="adm-card" key={key}>{rows(salesFormSchema.properties![key],model[key] as unknown as Row[],v=>change(key,v),key)}</section>)}
    </fieldset>
    <section className="adm-card"><h3>Проверка расчёта по предложению</h3><p className="adm-lead">Предварительный расчёт по введённым условиям. Без конвертации валют. Неизвестные расходы не считаются нулевыми; общий итог при неполных данных не выводится. Предоплата обслуживания указывается отдельно от периодической ставки.</p>
      <label>Предложение <select value={offerId} onChange={e=>setOfferId(e.target.value)}><option value="">Выберите</option>{model.offers.map(o=><option key={o.id} value={o.id}>{o.name || "Без названия"}</option>)}</select></label>
      {offer && unit ? <ul>{applicableFees(model,offer).map(f=>{const amount=feePreview(f,unit,offer.price,offer.currency,new Date().toISOString().slice(0,10));return <li key={f.id}>{f.name}: {amount === null ? "требует уточнения" : `${amount.toLocaleString("ru-RU",{maximumFractionDigits:2})} ${f.currency}`} · {optionLabels[f.period]}{f.advanceMonths!==null ? ` · аванс за ${f.advanceMonths} мес.` : ""}{f.mandatory==="optional"?" · по выбору":""}</li>;})}</ul>:null}
      {preview?.error ? <p role="status">{preview.error}</p>:null}
      {preview && !preview.error ? <ol>{preview.rows.map(r=><li key={r.id}>{r.name}: {r.amount.toLocaleString("ru-RU",{maximumFractionDigits:2})} {offer?.currency}</li>)}</ol>:null}
    </section>
    {mode==="admin" ? <section className="adm-card"><h3>Публикация условий для покупателей</h3><p>{publication?`Опубликована версия ${publication.revision}, до ${publication.expires_at.slice(0,10)}`:"Условия пока не опубликованы"}</p>
      <p className="adm-lead">Покупатель увидит юнит, цену, расходы, график и сведения о лицензиях. Внутренние ссылки на источники и примечания не публикуются. Заявка сохранит выбранное предложение и снимок этих условий. Сохранение новой внутренней версии само по себе не меняет опубликованную.</p>
      <label>Показывать до <input type="date" value={until} onChange={e=>setUntil(e.target.value)} /></label>
      <label style={{display:"block",margin:"12px 0"}}><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} /> Условия проверены для публикации покупателям</label>
      <button type="button" className="adm-btn" disabled={busy||dirty||!revision||!until||!approved} onClick={async()=>{setBusy(true);try{const r=await adminPublishSalesModel(projectId,revision,until);setMessage(r.ok?"Условия опубликованы на странице проекта":r.error??"Ошибка");if(r.ok){setPublication({revision,expires_at:until});setApproved(false);}}finally{setBusy(false);}}}>Опубликовать сохранённую версию</button>{" "}
      {publication?<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await adminWithdrawSalesModel(projectId);setMessage(r.ok?"Условия сняты с публикации":r.error??"Ошибка");if(r.ok)setPublication(null);}finally{setBusy(false);}}}>Снять с публикации</button>:null}
    </section>
    : <section className="adm-card"><h3>Проверка и публикация</h3><p>{publication?`Покупателям опубликована версия ${publication.revision} до ${publication.expires_at.slice(0,10)}.`:"Предложения пока не опубликованы."} Версия {revision || "новая"} в редакторе не заменяет публикацию автоматически. После отправки команда IE проверит источники и срок действия. Сохранение не продлевает цены.</p></section>}
    <section className="adm-card"><h3>Предпросмотр допустимых предложений</h3><p>Предпросмотр текущих полей, не публикация и не бронирование. Не показываются просроченные предложения, неподтверждённое наличие и проданные/зарезервированные юниты.</p>{(()=>{const p=publicSalesProjection(model,revision,units.map(u=>({...u,status:u.status??"unknown"})),new Date().toISOString().slice(0,10));return p.offers.length?<ul>{p.offers.map(o=><li key={o.id}>{o.label} · {optionLabels[o.ownership]??o.ownership} · {o.price.toLocaleString("ru-RU")} {o.currency} · цена {o.priceDate} · наличие {o.availabilityDate}</li>)}</ul>:<p>Нет предложений, готовых к показу. Проверьте цену, статус, источники и даты.</p>;})()}</section>
    <div className="adm-card" style={{position:"sticky",bottom:0,zIndex:2}}><button type="submit" className="adm-btn" disabled={busy}>{busy?"Сохранение…":mode==="partner"?"Отправить новую версию на проверку":"Сохранить новую версию"}</button> {dirty?"Есть несохранённые изменения":""}<p role="status" style={{whiteSpace:"pre-wrap"}}>{message}</p></div>
  </form>;
}
