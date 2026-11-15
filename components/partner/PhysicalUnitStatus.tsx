"use client";
import { useActionState } from "react";
import { upsertProjectUnit } from "@/app/actions/partner-marketplace";

export function PhysicalUnitStatus({ projectId, units }: { projectId: string; units: { id: string; label: string; status: string }[] }) {
  const [state, action, pending] = useActionState(upsertProjectUnit, { ok: false, error: undefined as string | undefined });
  return <section className="adm-card"><h2>Срочно обновить физический статус</h2>
    <p>«Бронь» и «Продан» сразу исключают юнит из публичных предложений, в том числе старой опубликованной версии. «Свободен» не публикует новую цену и не продлевает срок её действия. Если условия изменились, отправьте новую версию выше.</p>
    {units.length ? <form action={action}><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="physical_only" value="true" /><input type="hidden" name="label" value="physical status" />
      <label>Лот <select name="unit_id" required disabled={pending}>{units.map(u => <option key={u.id} value={u.id}>{u.label} · {({ unknown: "Уточняется", available: "Свободен", reserved: "Бронь", sold: "Продан" } as Record<string, string>)[u.status] ?? "Уточняется"}</option>)}</select></label>{" "}
      <label>Новый статус <select name="status" defaultValue="unknown" disabled={pending}><option value="unknown">Уточняется</option><option value="available">Свободен</option><option value="reserved">Бронь</option><option value="sold">Продан</option></select></label>{" "}
      <button className="adm-btn" disabled={pending}>{pending ? "Сохраняю…" : "Обновить статус"}</button>
      <p role="status">{state.ok ? "Физический статус обновлён. Цена и срок публикации не изменены." : state.error}</p>
    </form> : <p>Физических юнитов пока нет. Владелец может добавить их в редакторе условий.</p>}
  </section>;
}
