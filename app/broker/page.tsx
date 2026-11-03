import Link from "next/link";
import { redirect } from "next/navigation";
import { DEAL_STATUS_RU, ENTRY_STATUS_RU, fmtMoney, KIND_RU } from "@/lib/commission/format";
import { MILESTONE_RU, type Milestone } from "@/lib/commission/terms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Broker / agent cabinet: own deals and own money only (views and RLS scope everything to the org). */
export default async function BrokerPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p style={{ padding: 24 }}>Supabase не настроен</p>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") return <p style={{ padding: 24 }}>Нет доступа: нужна роль партнёра и организация.</p>;
  const { data: org } = await supabase.from("orgs").select("kind, name_ru").eq("id", prof.org_id).maybeSingle();
  if (org && org.kind !== "broker") redirect("/partner");

  const [deals, entries] = await Promise.all([
    supabase.from("broker_deals_v").select("*").order("created_at", { ascending: false }),
    supabase.from("ledger_entries").select("id, deal_id, milestone, kind, payer_org, payee_org, amount, paid_amount, currency, status, due_at").order("created_at"),
  ]);
  const projIds = [...new Set((deals.data ?? []).map((d) => d.project_id as string).filter(Boolean))];
  const { data: projs } = projIds.length ? await supabase.from("catalog_projects").select("id, slug, payload").in("id", projIds) : { data: [] };
  const pname = new Map((projs ?? []).map((p) => [p.id as string, ((p.payload as { n?: string } | null)?.n ?? p.slug) as string]));

  // Money by direction from this organisation's point of view
  const mine = prof.org_id as string;
  const sums = new Map<string, number>();
  for (const e of entries.data ?? []) {
    if (e.status === "void") continue;
    const incoming = e.payee_org === mine;
    const key = `${incoming ? "in" : "out"}|${e.status}|${e.currency}`;
    sums.set(key, (sums.get(key) ?? 0) + Number(e.amount) - Number(e.paid_amount));
  }
  const line = (dir: "in" | "out", status: string) =>
    [...sums.entries()].filter(([k]) => k.startsWith(`${dir}|${status}|`)).map(([k, v]) => fmtMoney(v, k.split("|")[2])).join(" · ") || "—";

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px" }}>
      <h1 className="serif text-2xl mb-1">Кабинет брокера</h1>
      <p className="text-sm mb-6" style={{ opacity: 0.75 }}>{org?.name_ru} · <Link href="/partner" className="underline">кабинет партнёра</Link></p>

      <section className="mb-8 text-sm space-y-1">
        <p>К получению сейчас: <b>{line("in", "due")}</b> · ожидается по этапам: {line("in", "expected")}</p>
        <p>К уплате (комиссия платформы, рефералы): <b>{line("out", "due")}</b> · ожидается: {line("out", "expected")}</p>
      </section>

      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Мои сделки</h2>
      <div className="overflow-x-auto mb-8">
        <table className="admin-table text-xs">
          <thead><tr><th>Дата</th><th>Проект</th><th>Цена</th><th>Комиссия застройщика</th><th>Платформа</th><th>Реферал</th><th>Мне</th><th>Статус</th></tr></thead>
          <tbody>
            {(deals.data ?? []).map((d) => (
              <tr key={d.id as string}>
                <td>{new Date(d.created_at as string).toLocaleDateString("ru-RU")}</td>
                <td>{pname.get(d.project_id as string) ?? "—"}</td>
                <td>{fmtMoney(d.contract_price as number, d.price_currency as string)}</td>
                <td>{fmtMoney(d.commission_gross as number, d.commission_currency as string)}</td>
                <td>{fmtMoney(d.platform_fee_total as number, d.commission_currency as string)}</td>
                <td>{fmtMoney(d.referral_fee_total as number, d.commission_currency as string)}</td>
                <td><b>{fmtMoney(d.broker_net as number, d.commission_currency as string)}</b></td>
                <td>{DEAL_STATUS_RU[d.status as string]}</td>
              </tr>
            ))}
            {(deals.data ?? []).length === 0 ? <tr><td colSpan={8}>Сделок пока нет.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Начисления и платежи</h2>
      <div className="overflow-x-auto">
        <table className="admin-table text-xs">
          <thead><tr><th>Этап</th><th>Вид</th><th>Направление</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Срок</th></tr></thead>
          <tbody>
            {(entries.data ?? []).map((e) => (
              <tr key={e.id as string} style={e.status === "void" ? { opacity: 0.5 } : undefined}>
                <td>{e.milestone ? MILESTONE_RU[e.milestone as Milestone] : "—"}</td>
                <td>{KIND_RU[e.kind as string]}</td>
                <td>{e.payee_org === mine ? "мне" : "от меня"}</td>
                <td>{fmtMoney(e.amount as number, e.currency as string)}</td>
                <td>{fmtMoney(e.paid_amount as number, e.currency as string)}</td>
                <td>{ENTRY_STATUS_RU[e.status as string]}</td>
                <td>{e.due_at ? new Date(e.due_at as string).toLocaleDateString("ru-RU") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
