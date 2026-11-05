"use client";
import { MEDIA_KINDS, mediaLabel } from "@/lib/project-media";
export type MediaMetadata = { media_kind: string; cover: boolean; sort_order: number; unit_id: string; type_label: string };
export const emptyMediaMetadata: MediaMetadata = {media_kind:"",cover:false,sort_order:0,unit_id:"",type_label:""};
export function mediaDetails(value: MediaMetadata) {
  return { ...(value.media_kind ? {media_kind:value.media_kind} : {}), ...(value.media_kind === "photo" || value.media_kind === "render" ? {render:value.media_kind === "render"} : {}), cover:value.cover, sort_order:value.sort_order, ...(value.unit_id ? {unit_id:value.unit_id} : {}), ...(value.type_label ? {type_label:value.type_label} : {}) };
}
export function MediaFields({value,onChange,disabled,units=[]}:{value:MediaMetadata;onChange:(v:MediaMetadata)=>void;disabled?:boolean;units?:{id:string;label:string}[]}) {
  return <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2"><legend className="text-sm font-bold">Назначение изображения</legend>
    <label className="block text-sm">Тип материала<select className="admin-inp" value={value.media_kind} onChange={e=>onChange({...value,media_kind:e.target.value})}><option value="">Не указан</option>{MEDIA_KINDS.map(k=><option key={k} value={k}>{mediaLabel({media_kind:k},"ru")}</option>)}</select></label>
    <label className="block text-sm">Порядок (меньше — раньше)<input className="admin-inp" type="number" min={0} max={9999} step={1} value={value.sort_order} onChange={e=>onChange({...value,sort_order:Number(e.target.value)})}/></label>
    <label className="block text-sm">Привязка к лоту<select className="admin-inp" value={value.unit_id} onChange={e=>onChange({...value,unit_id:e.target.value})}><option value="">Весь проект / тип планировки</option>{units.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}</select></label>
    {value.media_kind === "type_plan" ? <label className="block text-sm">Название типа<input className="admin-inp" maxLength={120} value={value.type_label} onChange={e=>onChange({...value,type_label:e.target.value})} required/></label> : null}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.cover} onChange={e=>onChange({...value,cover:e.target.checked})}/>Предпочтительная обложка галереи</label>
  </fieldset>;
}
