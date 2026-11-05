"use client";

import { useRef, useState, useTransition } from "react";
import { usePreservedForm } from "@/components/forms/use-preserved-form";
import { useRouter } from "next/navigation";
import {
  adminStudioAddNews, adminStudioAddPromo, adminStudioDeleteNews, adminStudioDeletePromo, type NewsRow, type PromoRow,
} from "@/app/actions/admin-studio";

const KIND_NEWS: Record<string, string> = { construction: "Ход строительства", milestone: "Этап завершён", news: "Новость" };
const KIND_PROMO: Record<string, string> = { sale: "Акция / скидка", launch: "Старт продаж", other: "Другое" };
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("ru-RU") : "");

export function NewsPanel({ projectId, news, promos }: { projectId: string; news: NewsRow[]; promos: PromoRow[] }) {
  const router = useRouter();
  const [deleting, start] = useTransition();
  const deletingRef = useRef(false);
  const [deleteError, setDeleteError] = useState("");
  const { state: ns, onSubmit: nSubmit, formRef: nForm, pending: nPending } = usePreservedForm(async (p: { ok: boolean; error?: string }, fd: FormData) => {
    const r = await adminStudioAddNews(projectId, p, fd);
    if (r.ok) router.refresh();
    return r;
  });
  const { state: ps, onSubmit: pSubmit, formRef: pForm, pending: pPending } = usePreservedForm(async (p: { ok: boolean; error?: string }, fd: FormData) => {
    const r = await adminStudioAddPromo(projectId, p, fd);
    if (r.ok) router.refresh();
    return r;
  });

  const del = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    if (deletingRef.current || !confirm("Удалить запись?")) return;
    deletingRef.current = true;
    setDeleteError("");
    start(async () => {
      try {
        const result = await fn();
        if (result.ok) router.refresh();
        else setDeleteError(result.error || "Не удалось удалить запись.");
      } catch {
        setDeleteError("Не удалось получить результат удаления. Обновите список перед повторной попыткой.");
      } finally { deletingRef.current = false; }
    });
  };

  return (
    <>
      {deleteError ? <p role="alert" className="adm-msg err">{deleteError}</p> : null}
      <section className="adm-card">
        <h3>Новости со стройки</h3>
        <p className="adm-lead">Короткие записи о ходе работ показываются на странице проекта и в ленте на главной.</p>
        <form ref={nForm} onSubmit={nSubmit}>
          <fieldset disabled={nPending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="adm-grid">
            <div className="adm-field c4"><label>Тип</label><select name="kind" defaultValue="construction">{Object.entries(KIND_NEWS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="adm-field c4"><label>Дата</label><input type="date" name="date" defaultValue={today()} max={today()} /></div>
            <div className="adm-field c12"><label>Заголовок</label><input name="title" placeholder="Например: Завершён монтаж каркаса блока A" required /></div>
            <div className="adm-field c12"><label>Текст (необязательно)</label><textarea name="body" /></div>
          </div>
          <p style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <button className="adm-btn" disabled={nPending}>Опубликовать</button>
            {ns.error ? <span className="adm-msg err">{ns.error}</span> : null}
          </p>
        </fieldset>
        </form>
        <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 8 }}>
          {news.map((n) => (
            <li key={n.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderTop: "1px solid var(--bdr)", paddingTop: 8 }}>
              <span className="adm-pill">{KIND_NEWS[n.kind] ?? n.kind}</span>
              <span className="adm-hint">{fmt(n.published_at)}</span>
              <b style={{ flex: 1, fontSize: 14 }}>{n.title_ru}</b>
              <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={deleting} onClick={() => del(() => adminStudioDeleteNews(projectId, n.id))}>✕</button>
            </li>
          ))}
          {news.length === 0 ? <li className="adm-hint">Записей пока нет.</li> : null}
        </ul>
      </section>

      <section className="adm-card">
        <h3>Акции и предложения</h3>
        <p className="adm-lead">Показываются на карточке проекта, пока акция действует.</p>
        <form ref={pForm} onSubmit={pSubmit}>
          <fieldset disabled={pPending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="adm-grid">
            <div className="adm-field c4"><label>Тип</label><select name="kind" defaultValue="sale">{Object.entries(KIND_PROMO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="adm-field c4"><label>Начало</label><input type="date" name="starts" /></div>
            <div className="adm-field c4"><label>Окончание</label><input type="date" name="ends" /></div>
            <div className="adm-field c12"><label>Описание акции</label><input name="label" placeholder="Скидка 5% при бронировании до 30 ноября" required /></div>
          </div>
          <p style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <button className="adm-btn" disabled={pPending}>Добавить акцию</button>
            {ps.error ? <span className="adm-msg err">{ps.error}</span> : null}
          </p>
        </fieldset>
        </form>
        <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 8 }}>
          {promos.map((c) => (
            <li key={c.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderTop: "1px solid var(--bdr)", paddingTop: 8 }}>
              <span className="adm-pill">{KIND_PROMO[c.kind] ?? c.kind}</span>
              <span className="adm-hint">{c.starts_at ? fmt(c.starts_at) : "—"} → {c.ends_at ? fmt(c.ends_at) : "—"}</span>
              <b style={{ flex: 1, fontSize: 14 }}>{c.label_ru}</b>
              <button type="button" className="adm-btn adm-btn--danger adm-btn--sm" disabled={deleting} onClick={() => del(() => adminStudioDeletePromo(projectId, c.id))}>✕</button>
            </li>
          ))}
          {promos.length === 0 ? <li className="adm-hint">Акций нет.</li> : null}
        </ul>
      </section>
    </>
  );
}

