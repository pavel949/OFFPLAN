"use client";

import { useActionState } from "react";
import { saveProjectUpdate } from "@/app/actions/partner-marketplace";

const initial = { ok: false as boolean, error: undefined as string | undefined };
const KIND_RU: Record<string, string> = { construction: "Ход строительства", milestone: "Этап завершён", news: "Новость" };

type Row = { id: string; kind: string; title_en: string; title_ru: string; published_at: string };

export function UpdatesClient({ projectId, initialList }: { projectId: string; initialList: Row[] }) {
  const [state, action, pending] = useActionState(saveProjectUpdate, initial);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <form action={action} className="adm-card" key={initialList.length}>
        <input type="hidden" name="project_id" value={projectId} />
        <h3>Новая запись</h3>
        <p className="adm-lead">Коротко о том, что изменилось на стройке. Запись сразу появится на странице проекта.</p>
        <div className="adm-grid">
          <div className="adm-field c4">
            <label>Тип записи</label>
            <select name="kind" defaultValue="construction">{Object.entries(KIND_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <div className="adm-field c12">
            <label>Заголовок</label>
            <input name="title_ru" required placeholder="Например: Завершён монтаж каркаса блока A" />
          </div>
          <div className="adm-field c12">
            <label>Подробности (необязательно)</label>
            <textarea name="body_ru" />
          </div>
        </div>
        <p style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <button type="submit" className="adm-btn" disabled={pending}>{pending ? "Публикую…" : "Опубликовать"}</button>
          {state.ok ? <span className="adm-msg ok">Опубликовано</span> : null}
          {state.error ? <span className="adm-msg err">{state.error}</span> : null}
        </p>
      </form>

      <section className="adm-card">
        <h3>Опубликованные записи</h3>
        {initialList.length === 0 ? <p className="adm-hint">Записей пока нет.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
            {initialList.map((r) => (
              <li key={r.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderTop: "1px solid var(--bdr)", paddingTop: 8 }}>
                <span className="adm-pill">{KIND_RU[r.kind] ?? r.kind}</span>
                <span className="adm-hint">{new Date(r.published_at).toLocaleDateString("ru-RU")}</span>
                <b style={{ fontSize: 14 }}>{r.title_ru || r.title_en}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
