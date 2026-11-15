"use client";
import { useActionState } from "react";
import { updatePartnerLead } from "@/app/actions/partner-leads";
import { LEAD_STATUS_LABELS } from "@/lib/leads/partner";

export function LeadFollowUp({ id, status, mine, assigned, owner, responded }: { id: string; status: string; mine: boolean; assigned: boolean; owner: boolean; responded: boolean }) {
  const [state, action, pending] = useActionState(updatePartnerLead, { ok: false });
  return <form action={action}>
    <input type="hidden" name="lead_id" value={id} />
    {!assigned && <button className="adm-btn" name="action" value="claim" disabled={pending}>Взять в работу</button>}
    {mine && <>
      <label>Статус <select name="status" defaultValue={status} disabled={pending}>{Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="adm-btn" name="action" value="status" disabled={pending}>Сохранить статус</button>
      {!responded && <><p className="adm-hint">После фактического ответа покупателю отметьте его здесь. Будет сохранено текущее время; сообщение не отправляется.</p><button className="adm-btn" name="action" value="responded" disabled={pending}>Я ответил покупателю сейчас</button></>}
    </>}
    {assigned && (mine || owner) && <button className="adm-btn" name="action" value="release" disabled={pending}>Снять ответственного</button>}
    <p role="status" aria-live="polite">{pending ? "Сохраняем…" : state.error || (state.ok ? "Сохранено" : "")}</p>
  </form>;
}
