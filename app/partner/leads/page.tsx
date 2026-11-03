import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Leads for the partner's own organisation. Visibility is enforced by RLS (leads_partner_read). */
export default async function PartnerLeadsPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <p className="text-[var(--muted)]">Настройте Supabase в .env.local</p>;
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
        <p className="mb-4">
          <Link href="/partner" className="text-sm text-[var(--muted)] underline">
            ← Кабинет
          </Link>
        </p>
        <p className="text-[var(--muted)] text-sm">Нужна роль partner и организация.</p>
      </div>
    );
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, created_at, name, email, phone, message, project_name, status")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-4xl">
      <p className="mb-4">
        <Link href="/partner" className="text-sm text-[var(--muted)] underline">
          ← Кабинет
        </Link>
      </p>
      <h1 className="serif text-2xl mb-4">Заявки по вашим проектам</h1>
      {error ? <p className="text-[var(--red)] text-sm">{error.message}</p> : null}
      {!leads?.length ? (
        <p className="text-sm text-[var(--muted)]">Пока заявок нет.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="text-sm w-full" style={{ borderCollapse: "collapse" }}>
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
