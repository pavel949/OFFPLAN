"use client";

import { useActionState, useState } from "react";
import {
  adminCreateOrg,
  adminPreviewCommission,
  adminSaveAgreement,
  adminSaveBrokerTerms,
  adminSaveLeadRouting,
  adminSetAgreementStatus,
  type CommState,
} from "@/app/actions/commissions";
import { fmtMoney, KIND_RU } from "@/lib/commission/format";
import { MILESTONE_RU, type Milestone } from "@/lib/commission/terms";

const init: CommState = { ok: false };
const inp = "admin-inp mb-0";
const lbl = "text-xs flex flex-col gap-1";

export type OrgOpt = { id: string; name: string; kind: string };
export type ProjectOpt = { id: string; name: string; org_id: string | null };

function Msg({ s }: { s: CommState }) {
  if (s.error) return <p className="text-sm text-[var(--red)]">{s.error}</p>;
  if (s.ok && s.message) return <p className="text-sm text-[var(--grn)]">{s.message}</p>;
  return null;
}

function OrgSelect({ name, orgs, kind, any, required, defaultValue }: { name: string; orgs: OrgOpt[]; kind?: string; any?: string; required?: boolean; defaultValue?: string | null }) {
  return (
    <select name={name} required={required} defaultValue={defaultValue ?? ""} className="border rounded text-sm">
      {any !== undefined ? <option value="">{any}</option> : <option value="">—</option>}
      {orgs.filter((o) => !kind || o.kind === kind).map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

export function CreateOrgForm() {
  const [s, a] = useActionState(adminCreateOrg, init);
  return (
    <form action={a} className="flex flex-wrap gap-2 items-end">
      <label className={lbl}>Название (рус.)<input name="name_ru" required className={inp} /></label>
      <label className={lbl}>Name (en)<input name="name_en" className={inp} /></label>
      <label className={lbl}>Тип
        <select name="kind" className="border rounded text-sm">
          <option value="developer">Застройщик</option>
          <option value="broker">Брокер / агент</option>
          <option value="registry_operator">Оператор реестра</option>
        </select>
      </label>
      <button className="admin-btn py-1 px-3 text-sm">Создать</button>
      <Msg s={s} />
    </form>
  );
}

export function LeadRoutingForm({ orgs, current }: { orgs: OrgOpt[]; current: string | null }) {
  const [s, a] = useActionState(adminSaveLeadRouting, init);
  return (
    <form action={a} className="flex flex-wrap gap-2 items-end">
      <label className={lbl}>Брокер по умолчанию для новых заявок
        <OrgSelect name="default_broker_org_id" orgs={orgs} kind="broker" any="— не назначать —" defaultValue={current} />
      </label>
      <button className="admin-btn py-1 px-3 text-sm">Сохранить</button>
      <Msg s={s} />
    </form>
  );
}

export type AgreementInit = {
  id?: string; name?: string; developer_org_id?: string; broker_org_id?: string | null; project_id?: string | null;
  model?: string; percent?: number; fixed?: number; tiers?: unknown; tierMode?: string; min?: number | null; max?: number | null;
  basis?: string; currency?: string; payoutMode?: string; vatPercent?: number; clawbackDays?: number;
  sch?: Partial<Record<Milestone, { percent: number; delayDays: number }>>;
  exclusive?: boolean; visibility?: string; status?: string; valid_from?: string; valid_to?: string | null; note?: string;
};

export function AgreementForm({ orgs, projects, init: v = {} }: { orgs: OrgOpt[]; projects: ProjectOpt[]; init?: AgreementInit }) {
  const [s, a] = useActionState(adminSaveAgreement, init);
  const [model, setModel] = useState(v.model ?? "percent");
  const sch = v.sch ?? { reserved: { percent: 30, delayDays: 0 }, contract_signed: { percent: 40, delayDays: 0 }, won: { percent: 30, delayDays: 0 } };
  const row = (m: Milestone, p: string, d: string) => (
    <div key={m} className="flex gap-2 items-end">
      <label className={lbl}>{MILESTONE_RU[m]}, %<input name={p} defaultValue={sch[m]?.percent ?? 0} className={`${inp} w-20`} /></label>
      <label className={lbl}>отсрочка, дн.<input name={d} defaultValue={sch[m]?.delayDays ?? 0} className={`${inp} w-20`} /></label>
    </div>
  );
  return (
    <form action={a} className="space-y-3 rounded-lg border border-[var(--bdr)] p-4">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
      <div className="flex flex-wrap gap-3">
        <label className={lbl}>Название<input name="name" defaultValue={v.name ?? ""} className={inp} placeholder="Напр.: Стандарт 2026" /></label>
        <label className={lbl}>Застройщик *<OrgSelect name="developer_org_id" orgs={orgs} kind="developer" required defaultValue={v.developer_org_id} /></label>
        <label className={lbl}>Брокер<OrgSelect name="broker_org_id" orgs={orgs} kind="broker" any="любой брокер" defaultValue={v.broker_org_id} /></label>
        <label className={lbl}>Проект
          <select name="project_id" defaultValue={v.project_id ?? ""} className="border rounded text-sm max-w-[220px]">
            <option value="">все проекты застройщика</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className={lbl}>Модель
          <select name="model" value={model} onChange={(e) => setModel(e.target.value)} className="border rounded text-sm">
            <option value="percent">Процент от цены</option>
            <option value="fixed">Фиксированная сумма</option>
            <option value="tiered">Ступенчатая</option>
          </select>
        </label>
        {model === "percent" ? <label className={lbl}>Процент, %<input name="percent" defaultValue={v.percent} className={`${inp} w-24`} /></label> : null}
        {model === "fixed" ? <label className={lbl}>Сумма<input name="fixed" defaultValue={v.fixed} className={`${inp} w-32`} /></label> : null}
        <label className={lbl}>Валюта комиссии<input name="currency" defaultValue={v.currency ?? "THB"} maxLength={3} className={`${inp} w-20`} /></label>
        <label className={lbl}>Минимум<input name="min" defaultValue={v.min ?? ""} className={`${inp} w-28`} /></label>
        <label className={lbl}>Максимум<input name="max" defaultValue={v.max ?? ""} className={`${inp} w-28`} /></label>
        <label className={lbl}>База расчёта
          <select name="basis" defaultValue={v.basis ?? "contract_price"} className="border rounded text-sm">
            <option value="contract_price">Цена договора</option>
            <option value="net_price">Цена без налогов и сборов</option>
          </select>
        </label>
      </div>
      {model === "tiered" ? (
        <div className="space-y-1">
          <label className={lbl}>Режим ступеней
            <select name="tier_mode" defaultValue={v.tierMode ?? "marginal"} className="border rounded text-sm w-fit">
              <option value="marginal">по частям (каждая часть цены по своей ставке)</option>
              <option value="bracket">по диапазону (вся цена по ставке своего диапазона)</option>
            </select>
          </label>
          <label className={lbl}>Ступени (JSON)
            <textarea name="tiers_json" rows={4} defaultValue={JSON.stringify(v.tiers ?? [{ from: 0, to: 10000000, percent: 5 }, { from: 10000000, to: null, percent: 3 }], null, 1)} className={`${inp} font-mono text-xs w-full`} />
          </label>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-1">График выплаты комиссии (в сумме 100%)</p>
        <div className="flex flex-wrap gap-4">
          {row("reserved", "sch_reserved", "dly_reserved")}
          {row("contract_signed", "sch_contract", "dly_contract")}
          {row("won", "sch_won", "dly_won")}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className={lbl}>Порядок оплаты
          <select name="payout_mode" defaultValue={v.payoutMode ?? "direct"} className="border rounded text-sm">
            <option value="direct">Застройщик платит брокеру напрямую</option>
            <option value="via_platform">Застройщик платит платформе, платформа выплачивает брокеру</option>
          </select>
        </label>
        <label className={lbl}>НДС, % (справочно)<input name="vat_percent" defaultValue={v.vatPercent ?? 0} className={`${inp} w-20`} /></label>
        <label className={lbl}>Срок возврата при расторжении, дн.<input name="clawback_days" defaultValue={v.clawbackDays ?? 0} className={`${inp} w-24`} /></label>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className={lbl}>Действует с<input type="date" name="valid_from" defaultValue={v.valid_from} className={inp} /></label>
        <label className={lbl}>по<input type="date" name="valid_to" defaultValue={v.valid_to ?? ""} className={inp} /></label>
        <label className={lbl}>Статус
          <select name="status" defaultValue={v.status ?? "draft"} className="border rounded text-sm">
            <option value="draft">Черновик</option>
            <option value="active">Действует</option>
            <option value="archived">В архиве</option>
          </select>
        </label>
        <label className={lbl}>Видимость
          <select name="visibility" defaultValue={v.visibility ?? "parties"} className="border rounded text-sm">
            <option value="parties">Только стороны</option>
            <option value="public_to_brokers">Видно всем брокерам</option>
          </select>
        </label>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" name="exclusive" defaultChecked={v.exclusive} /> Эксклюзив (заявки проекта идут этому брокеру)</label>
      </div>
      <label className={lbl}>Примечание<input name="note" defaultValue={v.note ?? ""} className={`${inp} w-full`} /></label>
      <button className="admin-btn py-2 px-4">{v.id ? "Сохранить изменения" : "Создать соглашение"}</button>
      <Msg s={s} />
    </form>
  );
}

export function AgreementStatusButtons({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false);
  const set = async (st: "draft" | "active" | "archived") => {
    setBusy(true);
    await adminSetAgreementStatus(id, st);
    location.reload();
  };
  return (
    <span className="flex gap-2 text-xs">
      {status !== "active" ? <button disabled={busy} className="underline" onClick={() => set("active")}>активировать</button> : null}
      {status === "active" ? <button disabled={busy} className="underline" onClick={() => set("draft")}>в черновик</button> : null}
      {status !== "archived" ? <button disabled={busy} className="underline" onClick={() => set("archived")}>в архив</button> : null}
    </span>
  );
}

export function BrokerTermsForm({ orgs }: { orgs: OrgOpt[] }) {
  const [s, a] = useActionState(adminSaveBrokerTerms, init);
  const [type, setType] = useState("percent");
  return (
    <form action={a} className="flex flex-wrap gap-3 items-end rounded-lg border border-[var(--bdr)] p-4">
      <label className={lbl}>Брокер *<OrgSelect name="broker_org_id" orgs={orgs} kind="broker" required /></label>
      <label className={lbl}>Для застройщика<OrgSelect name="developer_org_id" orgs={orgs} kind="developer" any="для всех застройщиков" /></label>
      <label className={lbl}>Комиссия платформы
        <select name="fee_type" value={type} onChange={(e) => setType(e.target.value)} className="border rounded text-sm">
          <option value="none">нет</option>
          <option value="percent">процент от комиссии брокера</option>
          <option value="fixed">фикс. сумма за сделку</option>
        </select>
      </label>
      {type === "percent" ? <label className={lbl}>Процент, %<input name="fee_percent" className={`${inp} w-24`} /></label> : null}
      {type === "fixed" ? <label className={lbl}>Сумма<input name="fee_fixed" className={`${inp} w-28`} /></label> : null}
      <label className={lbl}>Реферал по умолчанию, %<input name="referral_default" defaultValue={0} className={`${inp} w-24`} /></label>
      <label className={lbl}>Действует с<input type="date" name="valid_from" className={inp} /></label>
      <label className={lbl}>по<input type="date" name="valid_to" className={inp} /></label>
      <label className={lbl}>Статус
        <select name="status" defaultValue="active" className="border rounded text-sm"><option value="active">Действует</option><option value="draft">Черновик</option><option value="archived">В архиве</option></select>
      </label>
      <button className="admin-btn py-2 px-4">Добавить условия</button>
      <Msg s={s} />
    </form>
  );
}

export function PreviewForm({ orgs, projects }: { orgs: OrgOpt[]; projects: ProjectOpt[] }) {
  const [s, a, pending] = useActionState(adminPreviewCommission, init);
  const p = s.preview;
  return (
    <div className="space-y-3">
      <form action={a} className="flex flex-wrap gap-3 items-end">
        <label className={lbl}>Застройщик<OrgSelect name="developer_org_id" orgs={orgs} kind="developer" required /></label>
        <label className={lbl}>Брокер<OrgSelect name="broker_org_id" orgs={orgs} kind="broker" required /></label>
        <label className={lbl}>Проект
          <select name="project_id" className="border rounded text-sm max-w-[200px]"><option value="">—</option>{projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </label>
        <label className={lbl}>Цена договора<input name="price" required className={`${inp} w-32`} /></label>
        <label className={lbl}>Валюта<input name="price_currency" defaultValue="THB" maxLength={3} className={`${inp} w-16`} /></label>
        <label className={lbl}>Курс к валюте комиссии<input name="fx_rate" className={`${inp} w-24`} /></label>
        <label className={lbl}>Реферер<OrgSelect name="referrer_org_id" orgs={orgs} kind="broker" any="нет" /></label>
        <label className={lbl}>Реферал, %<input name="referral_percent" className={`${inp} w-20`} /></label>
        <button className="admin-btn py-2 px-4" disabled={pending}>Рассчитать</button>
      </form>
      {s.error ? <p className="text-sm text-[var(--red)]">{s.error}</p> : null}
      {p ? (
        <div className="text-sm space-y-2">
          <p>
            База: <b>{fmtMoney(p.basisPrice, p.currency)}</b> · комиссия застройщика: <b>{fmtMoney(p.gross, p.currency)}</b> ·
            платформа: <b>{fmtMoney(p.platformFeeTotal, p.currency)}</b> · реферал: <b>{fmtMoney(p.referralTotal, p.currency)}</b> ·
            брокеру: <b>{fmtMoney(p.brokerNet, p.currency)}</b>
          </p>
          <table className="admin-table text-xs">
            <thead><tr><th>Этап</th><th>Вид</th><th>Платит</th><th>Получает</th><th>Сумма</th><th>Отсрочка</th></tr></thead>
            <tbody>
              {p.entries.map((e, i) => (
                <tr key={i}>
                  <td>{MILESTONE_RU[e.milestone as Milestone]}</td><td>{KIND_RU[e.kind]}</td><td>{e.payer}</td><td>{e.payee}</td>
                  <td>{fmtMoney(e.amount, p.currency)}</td><td>{e.delayDays ? `${e.delayDays} дн.` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
