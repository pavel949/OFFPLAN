import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { DEAL_STATUS_RU, ENTRY_STATUS_RU, fmtMoney, KIND_RU, summarizeTerms } from "@/lib/commission/format";
import { MILESTONE_RU, type Milestone } from "@/lib/commission/terms";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import type { OrgOpt } from "../../commissions/forms";
import { AdjustmentForm, AdvanceForm, PaymentForm, ReplanButton } from "../deal-forms";

export const dynamic = "force-dynamic";

export default async function AdminDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getAdminSessionOk()) || !hasSupabaseServiceConfig()) {
    return <p className="text-[var(--red)] text-sm">Нужен вход в панель и настроенный Supabase.</p>;
  }
  const db = createServiceRoleClient();
  const { data: d } = await db.from("deals").select("*").eq("id", id).maybeSingle();
  if (!d) notFound();
  const [o, l, ev, proj] = await Promise.all([
    db.from("orgs").select("id, name_ru, kind"),
    db.from("ledger_entries").select("*").eq("deal_id", id).order("created_at"),
    db.from("deal_events").select("*").eq("deal_id", id).order("created_at", { ascending: false }),
    d.project_id ? db.from("catalog_projects").select("slug, payload").eq("id", d.project_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const orgs: OrgOpt[] = (o.data ?? []).map((x) => ({ id: x.id as string, name: x.name_ru as string, kind: x.kind as string }));
  const name = (oid: string | null) => (oid ? orgs.find((x) => x.id === oid)?.name ?? oid.slice(0, 8) : "Платформа");
  const entries = l.data ?? [];
  const planned = d.commission_gross != null;
  const snap = d.plan_snapshot as { terms?: Parameters<typeof summarizeTerms>[0]; referral_percent?: number | null } | null;
  const pname = (proj.data?.payload as { n?: string } | null)?.n ?? proj.data?.slug ?? "—";
  const cur = d.commission_currency as string | null;

  return (
    <div className="max-w-6xl space-y-8">
      <p><Link href="/admin/deals" className="text-sm underline">← Все сделки</Link></p>
      <div>
        <h1 className="serif text-2xl mb-1">{pname}</h1>
        <p className="text-sm text-[var(--txt2)]">
          {DEAL_STATUS_RU[d.status as string]} · застройщик: {name(d.developer_org_id as string)} · брокер: {name(d.broker_org_id as string)}
          {d.referrer_org_id ? ` · реферер: ${name(d.referrer_org_id as string)} (${d.referral_percent}%)` : ""}
        </p>
        <p className="text-sm mt-2">
          Цена договора: <b>{fmtMoney(d.contract_price as number, d.price_currency as string)}</b>
          {planned ? (
            <>
              {" "}· комиссия застройщика: <b>{fmtMoney(d.commission_gross as number, cur)}</b> · платформа: {fmtMoney(d.platform_fee_total as number, cur)} · реферал: {fmtMoney(d.referral_fee_total as number, cur)} · брокеру: <b>{fmtMoney(d.broker_net as number, cur)}</b>
            </>
          ) : (
            " · комиссия ещё не рассчитана"
          )}
        </p>
        {snap?.terms ? <p className="text-xs text-[var(--txt2)] mt-1">Условия на дату создания: {summarizeTerms(snap.terms)}</p> : null}
        {d.clawback_review ? <p className="text-sm mt-2 text-[var(--red)]">По сделке уже были платежи, а она закрыта без завершения: проверьте возврат комиссии (раздел «Корректировка»).</p> : null}
        <p className="mt-2"><ReplanButton dealId={id} /></p>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Статус сделки</h2>
        <AdvanceForm dealId={id} status={d.status as string} planned={planned} />
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">График начислений и платежи</h2>
        <div className="overflow-x-auto">
          <table className="admin-table text-xs">
            <thead><tr><th>Этап</th><th>Вид</th><th>Платит</th><th>Получает</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Срок</th><th>Платёж</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id as string} style={e.status === "void" ? { opacity: 0.5 } : undefined}>
                  <td>{e.milestone ? MILESTONE_RU[e.milestone as Milestone] : "—"}</td>
                  <td>{KIND_RU[e.kind as string]}</td>
                  <td>{name(e.payer_org as string | null)}</td>
                  <td>{name(e.payee_org as string | null)}</td>
                  <td>{fmtMoney(e.amount as number, e.currency as string)}</td>
                  <td>{fmtMoney(e.paid_amount as number, e.currency as string)}</td>
                  <td>{ENTRY_STATUS_RU[e.status as string]}</td>
                  <td>{e.due_at ? new Date(e.due_at as string).toLocaleDateString("ru-RU") : "—"}</td>
                  <td>{e.status === "due" ? <PaymentForm dealId={id} entryId={e.id as string} remaining={Number(e.amount) - Number(e.paid_amount)} /> : null}</td>
                </tr>
              ))}
              {entries.length === 0 ? <tr><td colSpan={9}>Начислений нет.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Корректировка / возврат</h2>
        <p className="text-xs text-[var(--txt2)] mb-2">Существующие начисления не редактируются: любое изменение фиксируется отдельной записью с причиной.</p>
        <AdjustmentForm dealId={id} orgs={orgs} />
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">История</h2>
        <ul className="text-sm space-y-1">
          {(ev.data ?? []).map((x) => (
            <li key={x.id as string}>
              <span className="text-[var(--txt2)]">{new Date(x.created_at as string).toLocaleString("ru-RU")}</span> · {x.event as string}
              {x.to_status ? `: ${DEAL_STATUS_RU[x.from_status as string] ?? x.from_status} → ${DEAL_STATUS_RU[x.to_status as string] ?? x.to_status}` : ""}
              {x.note ? ` — ${x.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
