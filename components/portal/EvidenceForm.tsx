"use client";

import { useActionState, useState } from "react";
import { submitProjectEvidence } from "@/app/actions/project-evidence";

const COSTS: [string, string][] = [
  ["cam", "Управляющая компания (общие расходы)"],
  ["utilities", "Коммунальные услуги"],
  ["land-tax", "Налог на землю и строения"],
  ["sinking", "Резервный фонд"],
  ["other-cost", "Другой расход"],
];
const STAGES: [string, string][] = [
  ["prelaunch", "Предстарт (сбор заявок)"],
  ["launch", "Старт продаж"],
  ["selling", "Идут продажи"],
  ["last_units", "Остались последние лоты"],
  ["sold_out", "Всё продано"],
];
const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";

/** Plain-language form: the technical `details` payload is assembled here, never typed by the developer. */
export function EvidenceForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(submitProjectEvidence, { ok: false } as { ok: boolean; error?: string });
  const [kind, setKind] = useState("amenity");
  const [v, setV] = useState<Record<string, string>>({ currency: "THB", basis: "unit", period: "month", cost: "cam", stage: "selling" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  let details: Record<string, unknown> = {};
  let factKey = "";
  let title = "";
  if (kind === "amenity") {
    details = { description: v.description ?? "" };
    title = v.title ?? "";
    factKey = slug(title);
  } else if (kind === "operating_cost") {
    details = { amount: Number(v.amount), currency: v.currency, basis: v.basis, period: v.period };
    factKey = v.cost;
    title = COSTS.find(([k]) => k === v.cost)?.[1] ?? "Расход";
  } else if (kind === "sales") {
    details = { stage: v.stage, ...(v.starts_at ? { starts_at: v.starts_at } : {}), ...(v.total_units ? { total_units: Number(v.total_units) } : {}) };
    factKey = "sales-stage";
    title = STAGES.find(([k]) => k === v.stage)?.[1] ?? "Стадия продаж";
  } else {
    details = { url: v.url ?? "", caption: v.caption ?? "" };
    title = v.caption ?? "";
    factKey = `photo-${slug(v.caption ?? "")}-${Date.now().toString(36)}`;
  }

  return (
    <form action={action} key={state.ok ? "sent" : "form"} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="fact_key" value={factKey} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="details" value={JSON.stringify(details)} />
      <div className="adm-grid">
        <div className="adm-field c6">
          <label>Что вы добавляете</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="amenity">Инфраструктура и преимущества (бассейн, спа, охрана…)</option>
            <option value="operating_cost">Расходы на содержание</option>
            <option value="sales">Стадия продаж</option>
            <option value="photo">Фото по ссылке</option>
          </select>
        </div>

        {kind === "amenity" ? (<>
          <div className="adm-field c6"><label>Название</label><input value={v.title ?? ""} onChange={set("title")} required placeholder="Бассейн 25 м" /></div>
          <div className="adm-field c12"><label>Описание</label><textarea value={v.description ?? ""} onChange={set("description")} required placeholder="Что именно есть и для кого" /></div>
        </>) : null}

        {kind === "operating_cost" ? (<>
          <div className="adm-field c6"><label>Вид расхода</label><select value={v.cost} onChange={set("cost")}>{COSTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="adm-field c3"><label>Сумма</label><input type="number" min={0} step="any" value={v.amount ?? ""} onChange={set("amount")} required /></div>
          <div className="adm-field c3"><label>Валюта</label><select value={v.currency} onChange={set("currency")}>{["THB", "USD", "EUR", "RUB"].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="adm-field c6"><label>За что</label><select value={v.basis} onChange={set("basis")}><option value="unit">за лот целиком</option><option value="sqm">за квадратный метр</option></select></div>
          <div className="adm-field c6"><label>Как часто</label><select value={v.period} onChange={set("period")}><option value="month">в месяц</option><option value="year">в год</option><option value="once">один раз</option></select></div>
        </>) : null}

        {kind === "sales" ? (<>
          <div className="adm-field c6"><label>Стадия</label><select value={v.stage} onChange={set("stage")}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="adm-field c3"><label>Дата старта</label><input type="date" value={v.starts_at ?? ""} onChange={set("starts_at")} /></div>
          <div className="adm-field c3"><label>Всего лотов</label><input type="number" min={1} value={v.total_units ?? ""} onChange={set("total_units")} /></div>
        </>) : null}

        {kind === "photo" ? (<>
          <div className="adm-field c6"><label>Ссылка на фото (https)</label><input type="url" value={v.url ?? ""} onChange={set("url")} required placeholder="https://" /></div>
          <div className="adm-field c6"><label>Подпись</label><input value={v.caption ?? ""} onChange={set("caption")} required placeholder="Фасад, блок A" /></div>
        </>) : null}

        <div className="adm-field c6"><label>Ссылка на источник (https)</label><input name="source_url" type="url" required placeholder="https://сайт-проекта/страница" /><span className="adm-hint">Страница или документ, где это подтверждается.</span></div>
        <div className="adm-field c3"><label>Дата сведений</label><input name="observed_at" type="date" required defaultValue={today()} max={today()} /></div>
      </div>
      <p className="adm-hint">Сведения публикуются после короткой проверки командой IE.</p>
      <p style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="adm-btn" disabled={pending}>{pending ? "Отправляю…" : "Отправить на проверку"}</button>
        {state.ok ? <span className="adm-msg ok">Отправлено на проверку</span> : null}
        {state.error ? <span className="adm-msg err">{state.error}</span> : null}
      </p>
    </form>
  );
}
