import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { InviteForm } from "./invite-form";

export default async function AdminDevelopersPage() {
  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Застройщики</h1>
        <p className="text-[var(--red)] text-sm">Задайте SUPABASE_SERVICE_ROLE_KEY в окружении.</p>
      </div>
    );
  }
  const db = createServiceRoleClient();
  const [orgs, projects, profiles] = await Promise.all([
    db.from("orgs").select("id, name_ru, website, created_at").eq("kind", "developer").order("created_at", { ascending: false }),
    db.from("catalog_projects").select("org_id"),
    db.from("profiles").select("org_id").eq("role", "partner"),
  ]);
  const count = (rows: { org_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.org_id) m.set(r.org_id, (m.get(r.org_id) ?? 0) + 1);
    return m;
  };
  const pc = count(projects.data);
  const uc = count(profiles.data);

  return (
    <div className="space-y-8">
      <h1 className="serif text-2xl">Застройщики</h1>
      <InviteForm />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Компания</th>
              <th>Сайт</th>
              <th>Пользователей</th>
              <th>Проектов</th>
            </tr>
          </thead>
          <tbody>
            {(orgs.data ?? []).map((o) => (
              <tr key={o.id as string}>
                <td>{o.name_ru as string}</td>
                <td>{(o.website as string) || "—"}</td>
                <td className="tabular-nums">{uc.get(o.id as string) ?? 0}</td>
                <td className="tabular-nums">{pc.get(o.id as string) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
