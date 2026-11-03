"use client";

import { useActionState, useState } from "react";
import {
  adminAddAdjustment,
  adminAdvanceDeal,
  adminCreateDeal,
  adminRecordPayment,
  adminReplanDeal,
  type CommState,
} from "@/app/actions/commissions";
import type { OrgOpt, ProjectOpt } from "../commissions/forms";

const init: CommState = { ok: false };
const inp = "admin-inp mb-0";
const lbl = "text-xs flex flex-col gap-1";

function Msg({ s }: { s: CommState }) {
  if (s.error) return <p className="text-sm text-[var(--red)]">{s.error}</p>;
  if (s.ok && s.message) return <p className="text-sm text-[var(--grn)]">{s.message}</p>;
  return null;
}

export function CreateDealForm({ orgs, projects }: { orgs: OrgOpt[]; projects: ProjectOpt[] }) {
  const [s, a] = useActionState(adminCreateDeal, init);
  return (
    <form action={a} className="flex flex-wrap gap-3 items-end rounded-lg border border-[var(--bdr)] p-4">
      <label className={lbl}>Проект *
        <select name="project_id" required className="border rounded text-sm max-w-[240px]"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </label>
      <label className={lbl}>Брокер *
        <select name="broker_org_id" required className="border rounded text-sm"><option value="">—</option>{orgs.filter((o) => o.kind === "broker").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </label>
      <label className={lbl}>Цена договора *<input name="contract_price" required className={`${inp} w-32`} /></label>
      <label className={lbl}>Валюта<input name="price_currency" defaultValue="THB" maxLength={3} className={`${inp} w-16`} /></label>
      <label className={lbl}>Цена без налогов<input name="net_price" className={`${inp} w-28`} /></label>
      <label className={lbl}>Курс<input name="fx_rate" className={`${inp} w-20`} /></label>
      <label className={lbl}>Реферер
        <select name="referrer_org_id" className="border rounded text-sm"><option value="">нет</option>{orgs.filter((o) => o.kind === "broker").map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      </label>
      <label className={lbl}>Реферал, %<input name="referral_percent" className={`${inp} w-20`} /></label>
      <label className={lbl}>ID лида<input name="lead_id" className={`${inp} w-48`} placeholder="uuid (необязательно)" /></label>
      <label className={lbl}>Заметка<input name="notes" className={`${inp} w-48`} /></label>
      <button className="admin-btn py-2 px-4">Создать сделку</button>
      <Msg s={s} />
      {s.ok && s.id ? <a className="underline text-sm" href={`/admin/deals/${s.id}`}>Открыть сделку →</a> : null}
    </form>
  );
}

const NEXT: Record<string, { value: string; label: string }[]> = {
  open: [{ value: "reserved", label: "Бронь внесена" }, { value: "contract_signed", label: "Договор подписан" }],
  reserved: [{ value: "contract_signed", label: "Договор подписан" }, { value: "won", label: "Сделка завершена" }],
  contract_signed: [{ value: "won", label: "Сделка завершена" }],
};

export function AdvanceForm({ dealId, status, planned }: { dealId: string; status: string; planned: boolean }) {
  const [s, a] = useActionState(adminAdvanceDeal, init);
  const opts = NEXT[status] ?? [];
  if (!["open", "reserved", "contract_signed"].includes(status)) return null;
  return (
    <form action={a} className="flex flex-wrap gap-2 items-end">
      <input type="hidden" name="deal_id" value={dealId} />
      <label className={lbl}>Действие
        <select name="status" className="border rounded text-sm">
          {planned ? opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : null}
          <option value="lost">Сделка потеряна</option>
          <option value="cancelled">Сделка отменена</option>
        </select>
      </label>
      <label className={lbl}>Комментарий / причина<input name="note" className={`${inp} w-64`} /></label>
      <button className="admin-btn py-1 px-3 text-sm">Применить</button>
      {!planned ? <span className="text-xs text-[var(--amb)]">Сначала нужно рассчитать комиссию.</span> : null}
      <Msg s={s} />
    </form>
  );
}

export function ReplanButton({ dealId }: { dealId: string }) {
  const [msg, setMsg] = useState<CommState | null>(null);
  return (
    <span>
      <button type="button" className="underline text-sm" onClick={async () => { const r = await adminReplanDeal(dealId); setMsg(r); if (r.ok) location.reload(); }}>
        Рассчитать / пересчитать комиссию
      </button>
      {msg ? <Msg s={msg} /> : null}
    </span>
  );
}

export function PaymentForm({ dealId, entryId, remaining }: { dealId: string; entryId: string; remaining: number }) {
  const [s, a] = useActionState(adminRecordPayment, init);
  return (
    <form action={a} className="flex flex-wrap gap-1 items-end">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="entry_id" value={entryId} />
      <input name="amount" defaultValue={remaining} className={`${inp} w-24`} aria-label="Сумма" />
      <input name="reference" placeholder="№ платежа" className={`${inp} w-24`} />
      <input type="date" name="paid_at" className={inp} />
      <button className="admin-btn py-1 px-2 text-xs">Оплачено</button>
      <Msg s={s} />
    </form>
  );
}

export function AdjustmentForm({ dealId, orgs }: { dealId: string; orgs: OrgOpt[] }) {
  const [s, a] = useActionState(adminAddAdjustment, init);
  return (
    <form action={a} className="flex flex-wrap gap-2 items-end">
      <input type="hidden" name="deal_id" value={dealId} />
      <label className={lbl}>Вид<select name="kind" className="border rounded text-sm"><option value="adjustment">Корректировка</option><option value="clawback">Возврат комиссии</option></select></label>
      <label className={lbl}>Платит<select name="payer_org" className="border rounded text-sm"><option value="">Платформа</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className={lbl}>Получает<select name="payee_org" className="border rounded text-sm"><option value="">Платформа</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className={lbl}>Сумма<input name="amount" required className={`${inp} w-24`} /></label>
      <label className={lbl}>Валюта<input name="currency" defaultValue="THB" maxLength={3} className={`${inp} w-16`} /></label>
      <label className={lbl}>Причина *<input name="note" required minLength={5} className={`${inp} w-56`} /></label>
      <button className="admin-btn py-1 px-3 text-sm">Добавить</button>
      <Msg s={s} />
    </form>
  );
}
