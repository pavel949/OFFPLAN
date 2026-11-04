import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Leads for the partner's own organisation. Visibility is enforced by RLS (leads_partner_read). */
export default async function PartnerLeadsPage() {
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
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") {
    return (
      <div>
        <p className="pt-warn">Ваша учётная запись ещё не привязана к компании. Напишите нам, и мы подключим вас.</p>
      </div>
    );
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, created_at, name, email, phone, message, project_name, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="pt-hero"><div><h1>Заявки покупателей</h1><p>Люди, которые оставили контакты на страницах ваших проектов. Свяжитесь с ними в день обращения.</p></div></div>
      {error ? <p className="text-[var(--red)] text-sm">{error.message}</p> : null}
      {!leads?.length ? (
        <p className="adm-hint">Пока заявок нет. Они появятся здесь, как только покупатели оставят контакты на странице вашего проекта.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table">
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Дата</th>
                <th>Проект</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id as string} style={{ borderTop: "1px solid var(--line)" }}>
                  <td>{new Date(l.created_at as string).toLocaleDateString("ru-RU")}</td>
                  <td>{l.project_name}</td>
                  <td>{l.name}</td>
                  <td>
                    <a href={`mailto:${l.email}`}>{l.email}</a>
                  </td>
                  <td>{l.phone}</td>
                  <td style={{ maxWidth: 280 }}>{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
