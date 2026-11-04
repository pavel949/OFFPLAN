"use client";

import { useActionState } from "react";
import { submitCorrectionRequest } from "@/app/actions/partner";

export function CorrectionForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(submitCorrectionRequest, { ok: false } as { ok: boolean; error?: string });
  return (
    <form action={formAction} className="adm-card" key={state.ok ? "sent" : "new"}>
      <h3>Новая просьба</h3>
      <div className="adm-grid" style={{ marginTop: 12 }}>
        <div className="adm-field c12">
          <label>Проект</label>
          <select name="project_id" required defaultValue="">
            <option value="" disabled>Выберите проект…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="adm-field c12">
          <label>Что нужно исправить</label>
          <textarea name="message" required placeholder="Например: на сайте указана неверная цена или срок сдачи" />
        </div>
      </div>
      <p style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <button type="submit" className="adm-btn" disabled={pending}>{pending ? "Отправляю…" : "Отправить команде"}</button>
        {state.ok ? <span className="adm-msg ok">Отправлено. Мы ответим по почте.</span> : null}
        {state.error ? <span className="adm-msg err">{state.error}</span> : null}
      </p>
    </form>
  );
}
