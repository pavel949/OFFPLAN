"use client";

import { useActionState, useState } from "react";
import { adminStudioSaveInfo, type DeveloperOpt, type LocationOpt } from "@/app/actions/admin-studio";
import type { StudioProject } from "@/app/actions/admin-studio";
import {
  BEACH_KEYS, FOCUS_KEYS, MANAGEMENT_KEYS, OWNERSHIP_KEYS, PROPERTY_TYPES, SEGMENTS, STATUS_KEYS, taxLabel,
} from "@/lib/taxonomy";

function Field({ label, hint, cls = "c4", required, children }: { label: string; hint?: string; cls?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className={`adm-field ${cls}`}>
      <label>{label}{required ? <em>*</em> : null}</label>
      {children}
      {hint ? <span className="adm-hint">{hint}</span> : null}
    </div>
  );
}

function Opts({ kind, keys }: { kind: "seg" | "type" | "stK" | "beach" | "own" | "mgmt" | "focus"; keys: readonly string[] }) {
  return <>{keys.map((k) => <option key={k} value={k}>{taxLabel(kind, k, "ru")}</option>)}</>;
}

export function InfoForm({
  project, developers, locations, regions,
}: {
  project: StudioProject;
  developers: DeveloperOpt[];
  locations: LocationOpt[];
  regions: { id: string; name: string; country: string }[];
}) {
  const p = project.payload;
  const [state, action, pending] = useActionState(adminStudioSaveInfo.bind(null, project.id), { ok: false } as { ok: boolean; error?: string });
  const [dev, setDev] = useState(project.developerId ?? "");
  const [loc, setLoc] = useState(project.regionId ?? "");

  const byRegion = new Map<string, LocationOpt[]>();
  for (const l of locations) {
    const k = `${l.country} · ${l.region || "—"}`;
    byRegion.set(k, [...(byRegion.get(k) ?? []), l]);
  }

  return (
    <form action={action}>
      <section className="adm-card">
        <h3>1 · Основное</h3>
        <p className="adm-lead">Название, застройщик и расположение. Застройщика и район выбирайте из справочника: так проект попадёт в досье застройщика и на страницу локации.</p>
        <div className="adm-grid">
          <Field label="Название проекта" cls="c6" required><input name="n" defaultValue={p.n} required minLength={2} /></Field>
          <Field label="Застройщик" cls="c6" required hint="Нет в списке? Выберите «+ Новый застройщик».">
            <select name="developer_id" value={dev} onChange={(e) => setDev(e.target.value)} required>
              <option value="">Выберите…</option>
              {developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="__new">+ Новый застройщик</option>
            </select>
          </Field>
          {dev === "__new" ? (
            <Field label="Название нового застройщика" cls="c12" required><input name="devNewName" placeholder="Например: Angsana Group Co., Ltd." /></Field>
          ) : null}
          <Field label="Локация (район)" cls="c6" required hint="Определяет страницу локации и фильтр на главной.">
            <select name="region_id" value={loc} onChange={(e) => setLoc(e.target.value)} required>
              <option value="">Выберите…</option>
              {[...byRegion].map(([group, list]) => (
                <optgroup key={group} label={group}>
                  {list.map((l) => <option key={l.id} value={l.id}>{l.name_ru}{l.name_ru !== l.name_en ? ` (${l.name_en})` : ""}</option>)}
                </optgroup>
              ))}
              <option value="__new">+ Новая локация</option>
            </select>
          </Field>
          <Field label="Тип объекта" cls="c3"><select name="type" defaultValue={p.type}><Opts kind="type" keys={PROPERTY_TYPES} /></select></Field>
          <Field label="Сегмент" cls="c3"><select name="seg" defaultValue={p.seg}><Opts kind="seg" keys={SEGMENTS} /></select></Field>
        </div>
        {loc === "__new" ? (
          <div className="adm-sub-grid adm-grid">
            <Field label="Название (по-английски)" cls="c4" required><input name="zoneNewEn" placeholder="Bang Tao" /></Field>
            <Field label="Название по-русски" cls="c4"><input name="zoneNewRu" placeholder="Банг-Тао" /></Field>
            <Field label="Город / провинция" cls="c4" required>
              <select name="zoneNewParent" defaultValue="">
                <option value="">Выберите…</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.country} · {r.name}</option>)}
              </select>
            </Field>
          </div>
        ) : null}
      </section>

      <section className="adm-card">
        <h3>2 · Стадия и сроки</h3>
        <div className="adm-grid">
          <Field label="Стадия" cls="c4"><select name="stK" defaultValue={p.stK}><Opts kind="stK" keys={STATUS_KEYS} /></select></Field>
          <Field label="Год сдачи" cls="c4" required><input name="compY" type="number" min={1990} max={2100} defaultValue={p.compY} required /></Field>
          <Field label="Срок сдачи (текстом)" cls="c4" hint="Например: Q4 2027"><input name="compQ" defaultValue={p.compQ} /></Field>
        </div>
      </section>

      <section className="adm-card">
        <h3>3 · Цены и лоты</h3>
        <p className="adm-lead">Минимальная цена показывается на карточке. Подробный прайс по лотам вносится на вкладке «Лоты и цены».</p>
        <div className="adm-grid">
          <Field label="Цена «от», млн ฿" cls="c3" hint="Например: 7.5"><input name="priceFromM" type="number" step="0.01" min={0} defaultValue={p.pN || ""} /></Field>
          <Field label="Цена за м² (текстом)" cls="c3" hint="Например: 180,000–250,000"><input name="sqmP" defaultValue={p.sqmP} /></Field>
          <Field label="Всего лотов в проекте" cls="c3" hint="Например: 120"><input name="units" defaultValue={p.units} /></Field>
          <Field label="Площади лотов, м²" cls="c3" hint="Например: 35–120 sqm"><input name="unitSzM2" defaultValue={p.unitSzM2} /></Field>
          <Field label="Мин. число спален" cls="c3"><input name="minBR" type="number" min={0} max={20} defaultValue={p.minBR} /></Field>
          <Field label="Единица цены" cls="c3" hint="Если нужна пометка"><input name="pU" defaultValue={p.pU} /></Field>
        </div>
      </section>

      <section className="adm-card">
        <h3>4 · Параметры для инвестора</h3>
        <div className="adm-grid">
          <Field label="До пляжа" cls="c3"><select name="beach" defaultValue={p.beach}><Opts kind="beach" keys={BEACH_KEYS} /></select></Field>
          <Field label="Собственность" cls="c3"><select name="own" defaultValue={p.own}><Opts kind="own" keys={OWNERSHIP_KEYS} /></select></Field>
          <Field label="Управление" cls="c3"><select name="mgmt" defaultValue={p.mgmt}><Opts kind="mgmt" keys={MANAGEMENT_KEYS} /></select></Field>
          <Field label="Фокус" cls="c3"><select name="focus" defaultValue={p.focus}><Opts kind="focus" keys={FOCUS_KEYS} /></select></Field>
          <Field label="Доходность (заявленная)" cls="c4" hint="Например: 6–8%"><input name="yield" defaultValue={p.yield} /></Field>
          <Field label="Метки" cls="c8" hint="Через запятую, до 12. Например: Beachfront, Brand"><input name="tags" defaultValue={p.tags.join(", ")} /></Field>
        </div>
      </section>

      <section className="adm-card">
        <h3>5 · Описание и источник</h3>
        <div className="adm-grid">
          <Field label="Описание проекта" cls="c12" hint="Не короче 80 символов; факты из источника, без оценок."><textarea name="desc" defaultValue={p.desc} /></Field>
          <Field label="Источник данных" cls="c12" hint="Ссылка на сайт застройщика или название документа."><input name="src" defaultValue={p.src} /></Field>
        </div>
      </section>

      <details className="adm-card">
        <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase" }}>6 · Оценка редакции (рейтинг, риск, рекомендация)</summary>
        <p className="adm-lead" style={{ marginTop: 10 }}>Заполняет редакция IE после проверки. Застройщики эти поля не видят и не меняют.</p>
        <div className="adm-grid">
          <Field label="Рейтинг (0–10)" cls="c3"><input name="rat" type="number" step="0.1" min={0} max={10} defaultValue={p.rat} /></Field>
          <Field label="Уровень риска" cls="c3">
            <select name="risk" defaultValue={String(p.risk)}>
              {[1, 2, 3].map((r) => <option key={r} value={r}>{taxLabel("risk", r, "ru")}</option>)}
            </select>
          </Field>
          <Field label="Рекомендация" cls="c6">
            <select name="rec" defaultValue={p.rec}>
              {(["BUY", "WATCH", "AVOID"] as const).map((r) => <option key={r} value={r}>{taxLabel("rec", r, "ru")}</option>)}
            </select>
          </Field>
          <Field label="Комментарий редакции" cls="c12"><textarea name="recText" defaultValue={p.recText} /></Field>
        </div>
      </details>

      <div className="adm-savebar">
        <button className="adm-btn" disabled={pending}>{pending ? "Сохраняю…" : "Сохранить"}</button>
        <label><input type="checkbox" name="confirm" /> Данные подтверждены застройщиком сегодня</label>
        <span className="grow" />
        {state.ok ? <span className="adm-msg ok">Сохранено · сайт обновится сразу</span> : null}
        {state.error ? <span className="adm-msg err">{state.error}</span> : null}
      </div>
    </form>
  );
}
