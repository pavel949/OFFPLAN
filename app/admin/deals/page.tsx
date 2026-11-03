import Link from "next/link";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { DEAL_STATUS_RU, fmtMoney } from "@/lib/commission/format";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import type { OrgOpt, ProjectOpt } from "../commissions/forms";
import { CreateDealForm } from "./deal-forms";

export const dynamic = "force-dynamic";

export default async function AdminDealsPage() {
  if (!(await getAdminSessionOk()) || !hasSupabaseServiceConfig()) {
    return <p className="text-[var(--red)] text-sm">Нужен вход в панель и настроенный Supabase.</p>;
  }
  const db = createServiceRoleClient();
  const [d, o, p] = await Promise.all([
    db.from("deals").select("id, status, project_id, developer_org_id, broker_org_id, contract_price, price_currency, commission_gross, commission_currency, broker_net, platform_fee_total, clawback_review, created_at").order("created_at", { ascending: false }).limit(200),
    db.from("orgs").select("id, name_ru, kind").order("name_ru"),
    db.from("catalog_projects").select("id, org_id, slug, payload").order("slug"),
  ]);
  const orgs: OrgOpt[] = (o.data ?? []).map((x) => ({ id: x.id as string, name: x.name_ru as string, kind: x.kind as string }));
  const orgName = new Map(orgs.map((x) => [x.id, x.name]));
  const projects: ProjectOpt[] = (p.data ?? []).map((x) => ({
    id: x.id as string,
    org_id: (x.org_id as string) ?? null,
    name: ((x.payload as { n?: string } | null)?.n ?? (x.slug as string)).slice(0, 60),
  }));
  const projName = new Map(projects.map((x) => [x.id, x.name]));
  const rows = d.data ?? [];

  // totals of money not yet received / paid
  const { data: led } = await db.from("ledger_entries").select("kind, status, amount, paid_amount, currency").in("status", ["due"]);
  const dueByCur = new Map<string, number>();
  for (const e of led ?? []) {
    if (e.kind !== "commission") continue;
    dueByCur.set(e.currency as string, (dueByCur.get(e.currency as string) ?? 0) + Number(e.amount) - Number(e.paid_amount));
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="serif text-2xl mb-1">Сделки и комиссии</h1>
        <p className="text-sm text-[var(--txt2)] max-w-3xl">
          Сделка фиксирует снимок условий (<Link className="underline" href="/admin/commissions">соглашения</Link>) и строит график
          начислений по этапам: бронь → договор → завершение. Начисление становится «к оплате», когда сделка достигает этапа.
        </p>
        {dueByCur.size ? (
          <p className="text-sm mt-2">К получению от застройщиков: {[...dueByCur.entries()].map(([c, v]) => fmtMoney(v, c)).join(" · ")}</p>
        ) : null}
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Новая сделка</h2>
        <CreateDealForm orgs={orgs} projects={projects.filter((x) => x.org_id)} />
      </section>

      <div className="overflow-x-auto">
        <table className="admin-table text-xs">
          <thead><tr><th>Дата</th><th>Проект</th><th>Застройщик</th><th>Брокер</th><th>Цена</th><th>Комиссия</th><th>Брокеру</th><th>Статус</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id as string}>
                <td className="whitespace-nowrap"><Link className="underline" href={`/admin/deals/${r.id}`}>{new Date(r.created_at as string).toLocaleDateString("ru-RU")}</Link></td>
                <td>{r.project_id ? projName.get(r.project_id as string) ?? "—" : "—"}</td>
                <td>{r.developer_org_id ? orgName.get(r.developer_org_id as string) : "—"}</td>
                <td>{r.broker_org_id ? orgName.get(r.broker_org_id as string) : "—"}</td>
                <td>{fmtMoney(r.contract_price as number, r.price_currency as string)}</td>
                <td>{fmtMoney(r.commission_gross as number, r.commission_currency as string)}</td>
                <td>{fmtMoney(r.broker_net as number, r.commission_currency as string)}</td>
                <td>{DEAL_STATUS_RU[r.status as string] ?? r.status}{r.clawback_review ? " · ⚠ проверить возврат" : ""}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={8}>Сделок пока нет.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
