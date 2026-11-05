import Link from "next/link";
import { LeadFollowUp } from "@/components/partner/LeadFollowUp";
import { LEAD_STATUS_LABELS } from "@/lib/leads/partner";
import { leadSalesSummary } from "@/lib/leads/sales-summary";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Leads for the partner's own organisation. Visibility is enforced by RLS (leads_partner_read). */
export default async function PartnerLeadsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role, partner_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") {
    return (
      <div>
        <p className="pt-warn">Ваша учётная запись ещё не привязана к компании. Напишите нам, и мы подключим вас.</p>
      </div>
    );
  }

  let query = supabase
    .from("leads")
    .select("id, created_at, name, email, phone, message, project_name, status, sales_selection, project_uuid, responsible_id, responsible_name, first_response_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (project && /^[0-9a-f-]{36}$/i.test(project)) query = query.eq("project_uuid", project);
  const { data: leads, error } = await query;

  return (
    <div>
      <div className="pt-hero"><div><h1>Заявки покупателей</h1><p>Люди, которые оставили контакты на страницах ваших проектов. Свяжитесь с ними в день обращения.</p></div></div>
      <p className="adm-hint">Последние 200 обращений{project ? " по выбранному проекту" : ""}. Уведомление по email не заменяет этот список. Доставка уведомлений не подтверждена.</p>
      <p><Link href="/partner/analytics">Показатели витрины</Link>{project && <> · <Link href="/partner/leads">Все проекты</Link></>}</p>
      {error ? <p className="pt-warn">Не удалось загрузить заявки. Обновите страницу позже; это не означает, что заявок нет.</p> : null}
      {error ? null : !leads?.length ? (
        <p className="adm-hint">Пока заявок нет. Они появятся здесь, как только покупатели оставят контакты на странице вашего проекта.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Дата</th>
                <th>Проект</th>
                <th>Выбранные условия</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Сообщение</th>
                <th>Статус и ответственный</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id as string} style={{ borderTop: "1px solid var(--line)" }}>
                  <td>{new Date(l.created_at as string).toLocaleDateString("ru-RU")}</td>
                  <td>{l.project_uuid ? <Link href={`/partner/projects/${l.project_uuid}`}>{l.project_name || "Проект"}</Link> : l.project_name}</td>
                  <td>{(()=>{const s=leadSalesSummary(l.sales_selection);return s?<><b>{s.unit_label} · {s.ownership}</b><br/>{s.price.toLocaleString("ru-RU")} {s.currency}<br/><small>Цена {s.price_date}; наличие {s.availability_date}; версия {s.sales_revision}</small></>:l.sales_selection?"Условия выбранного юнита требуют уточнения":"Запрос по проекту";})()}</td>
                  <td>{l.name}</td>
                  <td>
                    <a href={`mailto:${l.email}`}>{l.email}</a>
                  </td>
                  <td>{l.phone}</td>
                  <td style={{ maxWidth: 280 }}>{l.message}</td>
                  <td style={{ minWidth: 240 }}>
                    <b>{LEAD_STATUS_LABELS[l.status] || l.status}</b>
                    <p>Ответственный: {l.responsible_id ? l.responsible_name || "Участник компании" : "Не назначен"}{l.responsible_id === user.id ? " (вы)" : ""}</p>
                    <p>{l.first_response_at ? `Первый ответ отмечен: ${new Date(l.first_response_at).toLocaleString("ru-RU", { timeZone: "UTC" })} UTC` : "Ответ ещё не отмечен"}</p>
                    <LeadFollowUp id={l.id} status={l.status} mine={l.responsible_id === user.id} assigned={!!l.responsible_id} owner={prof.partner_role === "owner"} responded={!!l.first_response_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
