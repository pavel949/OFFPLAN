"use client";
import { useActionState, useState } from "react";
import { submitProjectEvidence } from "@/app/actions/project-evidence";
import { mediaKind, mediaLabel } from "@/lib/project-media";
import type { ProjectEvidence } from "@/lib/project-evidence";
import { MediaFields, mediaDetails } from "./MediaFields";
export function MediaEditor({item,units}:{item:ProjectEvidence;units:{id:string;label:string}[]}) {
  const [state,action,pending] = useActionState(submitProjectEvidence,{ok:false} as {ok:boolean;error?:string});
  const kind = mediaKind(item.details);
  const [value,setValue] = useState({media_kind:kind === "unknown" ? "" : kind,cover:item.details.cover === true,sort_order:typeof item.details.sort_order === "number" ? item.details.sort_order : 0,unit_id:String(item.details.unit_id ?? ""),type_label:String(item.details.type_label ?? "")});
  const [caption,setCaption] = useState(String(item.details.caption ?? item.title));
  return <details className="adm-card"><summary>{item.title} · {mediaLabel(item.details,"ru")}</summary><form action={action} className="space-y-3 mt-3">
    <input type="hidden" name="project_id" value={item.project_id}/><input type="hidden" name="kind" value="photo"/><input type="hidden" name="fact_key" value={item.fact_key}/><input type="hidden" name="source_url" value={item.source_url}/><input type="hidden" name="observed_at" value={item.observed_at}/><input type="hidden" name="title" value={caption}/><input type="hidden" name="details" value={JSON.stringify({...item.details,...mediaDetails(value),media_kind:value.media_kind || undefined,render:value.media_kind === "render" ? true : value.media_kind === "photo" ? false : undefined,unit_id:value.unit_id || undefined,type_label:value.type_label || undefined,caption})}/>
    <label className="block text-sm">Подпись<input className="admin-inp" value={caption} onChange={e=>setCaption(e.target.value)} required maxLength={300} disabled={pending}/></label>
    <MediaFields value={value} onChange={setValue} units={units} disabled={pending}/>
    <p className="adm-hint">Изменения заменят эту версию после одобрения. Чтобы сменить обложку, снимите отметку с прежней и выберите новую. Среди нескольких обложек первой будет с меньшим порядком; планы не используются как фон проекта.</p>
    <button className="admin-btn" disabled={pending || state.ok}>{pending ? "Отправляем…" : state.ok ? "Отправлено на проверку" : "Отправить изменения на проверку"}</button>{state.error ? <p role="alert">{state.error}</p> : null}
  </form></details>;
}
