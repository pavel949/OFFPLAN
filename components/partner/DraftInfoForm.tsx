"use client";

import { useActionState } from "react";
import { partnerSaveDraftFields } from "@/app/actions/partner-studio";
import { submitProjectForModeration } from "@/app/actions/moderation";
import { Field, Opts } from "@/components/admin/fields";
import type { CatalogPayload } from "@/lib/studio";
import { BEACH_KEYS, FOCUS_KEYS, MANAGEMENT_KEYS, OWNERSHIP_KEYS, PROPERTY_TYPES, SEGMENTS, STATUS_KEYS } from "@/lib/taxonomy";

type Loc = { id: string; name_en: string; name_ru: string; region: string };

export function DraftInfoForm({
  projectId, payload, locations, locked, canEdit,
}: { projectId: string; payload: CatalogPayload; locations: Loc[]; locked: boolean; canEdit: boolean }) {
  const p = payload;
  const readOnly = locked || !canEdit;
  const [save, saveAction, saving] = useActionState(partnerSaveDraftFields.bind(null, projectId), { ok: false } as { ok: boolean; error?: string });
  const [sub, subAction, submitting] = useActionState(submitProjectForModeration, { ok: false } as { ok: boolean; error?: string });
  const current = locations.find((l) => l.name_en === p.zone)?.id ?? "";

  return (
    <>
      <form action={saveAction}>
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="adm-card">
            <h3>1 · Основное</h3>
            <div className="adm-grid">
              <Field label="Название проекта" cls="c6" required><input name="n" defaultValue={p.n} required minLength={2} /></Field>
              <Field label="Район" cls="c6" required hint="Нет вашего района? Напишите нам, мы добавим.">
                <select name="region_id" defaultValue={current} required>
                  <option value="">Выберите…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.region ? `${l.region} · ` : ""}{l.name_ru}</option>)}
                </select>
              </Field>
              <Field label="Тип объекта" cls="c4"><select name="type" defaultValue={p.type}><Opts kind="type" keys={PROPERTY_TYPES} /></select></Field>
              <Field label="Сегмент" cls="c4"><select name="seg" defaultValue={p.seg}><Opts kind="seg" keys={SEGMENTS} /></select></Field>
              <Field label="Стадия" cls="c4"><select name="stK" defaultValue={p.stK}><Opts kind="stK" keys={STATUS_KEYS} /></select></Field>
              <Field label="Год сдачи" cls="c4" hint="Пусто — срок неизвестен"><input name="compY" type="number" min={1990} max={2100} defaultValue={p.compY ?? ""} /></Field>
              <Field label="Срок сдачи (текстом)" cls="c4" hint="Например: Q4 2027"><input name="compQ" defaultValue={p.compQ} /></Field>
            </div>
          </section>
          <section className="adm-card">
            <h3>2 · Цены и состав</h3>
            <p className="adm-lead">Минимальная цена показывается на карточке. Цены по каждому лоту вносятся на вкладке «Лоты и цены».</p>
            <div className="adm-grid">
              <Field label="Цена «от», млн ฿" cls="c3" hint="Например: 7.5"><input name="priceFromM" type="number" step="0.01" min={0} defaultValue={p.pN || ""} /></Field>
              <Field label="Цена за м² (текстом)" cls="c3" hint="Например: 180,000–250,000"><input name="sqmP" defaultValue={p.sqmP} /></Field>
              <Field label="Всего лотов в проекте" cls="c3"><input name="units" defaultValue={p.units} /></Field>
              <Field label="Площади лотов, м²" cls="c3" hint="Например: 35–120 sqm"><input name="unitSzM2" defaultValue={p.unitSzM2} /></Field>
              <Field label="Мин. число спален" cls="c3"><input name="minBR" type="number" min={0} max={20} defaultValue={p.minBR ?? ""} /></Field>
              <Field label="Пометка к цене" cls="c3" hint="Необязательно"><input name="pU" defaultValue={p.pU} /></Field>
            </div>
          </section>
          <section className="adm-card">
            <h3>3 · Параметры для покупателя</h3>
            <div className="adm-grid">
              <Field label="До пляжа" cls="c3"><select name="beach" defaultValue={p.beach}><Opts kind="beach" keys={BEACH_KEYS} /></select></Field>
              <Field label="Собственность" cls="c3"><select name="own" defaultValue={p.own}><Opts kind="own" keys={OWNERSHIP_KEYS} /></select></Field>
              <Field label="Управление" cls="c3"><select name="mgmt" defaultValue={p.mgmt}><Opts kind="mgmt" keys={MANAGEMENT_KEYS} /></select></Field>
              <Field label="Фокус" cls="c3"><select name="focus" defaultValue={p.focus}><Opts kind="focus" keys={FOCUS_KEYS} /></select></Field>
              <Field label="Заявленная доходность" cls="c4" hint="Только если вы её гарантируете. Например: 6–8%"><input name="yield" defaultValue={p.yield} /></Field>
              <Field label="Метки" cls="c8" hint="Через запятую, до 12. Например: Первая линия, Брендированные"><input name="tags" defaultValue={p.tags.join(", ")} /></Field>
            </div>
          </section>
          <section className="adm-card">
            <h3>4 · Описание</h3>
            <div className="adm-grid">
              <Field label="Описание проекта" cls="c12" hint="Не короче 80 символов. Факты о проекте без оценок и обещаний доходности."><textarea name="desc" defaultValue={p.desc} /></Field>
              <Field label="Ссылка на сайт проекта или документ-источник" cls="c12"><input name="src" defaultValue={p.src} placeholder="https://" /></Field>
            </div>
          </section>
        </fieldset>
        <div className="adm-savebar">
          <button className="adm-btn" disabled={saving || readOnly}>{saving ? "Сохраняю…" : "Сохранить черновик"}</button>
          <span className="adm-hint">Черновик виден только вам и команде IE.</span>
          <span className="grow" />
          {save.ok ? <span className="adm-msg ok">Черновик сохранён</span> : null}
          {save.error ? <span className="adm-msg err">{save.error}</span> : null}
        </div>
      </form>

      <section className="adm-card" style={{ marginTop: 18 }}>
        <h3>Отправить на проверку</h3>
        <p className="adm-lead">Когда карточка заполнена, отправьте её команде IE. Мы проверим данные и опубликуем. Для уже опубликованного проекта на сайте остаётся прежняя версия, пока мы не одобрим новую.</p>
        <form action={subAction} style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="project_id" value={projectId} />
          <button className="adm-btn" disabled={submitting || readOnly}>{submitting ? "Отправляю…" : "Отправить на проверку"}</button>
          {sub.ok ? <span className="adm-msg ok">Отправлено. Мы ответим в ближайшие рабочие дни.</span> : null}
          {sub.error ? <span className="adm-msg err">{sub.error}</span> : null}
        </form>
      </section>
    </>
  );
}
