import { redirect } from "next/navigation";
import { DEAL_STATUS_RU, ENTRY_STATUS_RU, fmtMoney } from "@/lib/commission/format";
import { MILESTONE_RU, type Milestone } from "@/lib/commission/terms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Developer cabinet: deals on its projects and the commission it pays (nothing about the broker's side). */
export default async function PartnerDealsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") redirect("/partner");

  const [deals, entries] = await Promise.all([
    supabase.from("developer_deals_v").select("*").order("created_at", { ascending: false }),
    supabase.from("ledger_entries").select("id, milestone, kind, amount, paid_amount, currency, status, due_at").eq("kind", "commission").order("created_at"),
  ]);
  const projIds = [...new Set((deals.data ?? []).map((d) => d.project_id as string).filter(Boolean))];
  const { data: projs } = projIds.length ? await supabase.from("catalog_projects").select("id, slug, payload").in("id", projIds) : { data: [] };
  const pname = new Map((projs ?? []).map((p) => [p.id as string, ((p.payload as { n?: string } | null)?.n ?? p.slug) as string]));

  return (
    <div>
      <div className="pt-hero"><div><h1>Сделки и комиссии</h1><p>Сделки по вашим проектам и комиссия к оплате по этапам.</p></div></div>
      <div className="adm-scroll" style={{ marginBottom: 28 }}>
        <table className="adm-table">
          <thead><tr><th>Дата</th><th>Проект</th><th>Цена</th><th>Комиссия</th><th>Статус</th></tr></thead>
          <tbody>
            {(deals.data ?? []).map((d) => (
              <tr key={d.id as string}>
                <td>{new Date(d.created_at as string).toLocaleDateString("ru-RU")}</td>
                <td>{pname.get(d.project_id as string) ?? "—"}</td>
                <td>{fmtMoney(d.contract_price as number, d.price_currency as string)}</td>
                <td>{fmtMoney(d.commission_gross as number, d.commission_currency as string)}</td>
                <td>{DEAL_STATUS_RU[d.status as string]}</td>
              </tr>
            ))}
            {(deals.data ?? []).length === 0 ? <tr><td colSpan={5} className="adm-hint">Сделок пока нет.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 800, margin: "0 0 10px" }}>Комиссия к оплате по этапам</h2>
      <table className="adm-table">
        <thead><tr><th>Этап</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Срок</th></tr></thead>
        <tbody>
          {(entries.data ?? []).filter((e) => e.status !== "void").map((e) => (
            <tr key={e.id as string}>
              <td>{e.milestone ? MILESTONE_RU[e.milestone as Milestone] : "—"}</td>
              <td>{fmtMoney(e.amount as number, e.currency as string)}</td>
              <td>{fmtMoney(e.paid_amount as number, e.currency as string)}</td>
              <td>{ENTRY_STATUS_RU[e.status as string]}</td>
              <td>{e.due_at ? new Date(e.due_at as string).toLocaleDateString("ru-RU") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
