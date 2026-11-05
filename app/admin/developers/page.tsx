import Link from "next/link";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { DeveloperDirectory } from "./developer-directory";
import type { DirectoryDeveloper } from "@/lib/developer-directory";
import { InviteForm } from "./invite-form";

export default async function AdminDevelopersPage() {
  if (!(await getAdminSessionOk())) return null;
  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Застройщики</h1>
        <p className="text-[var(--red)] text-sm">Задайте SUPABASE_SERVICE_ROLE_KEY в окружении.</p>
      </div>
    );
  }
  const db = createServiceRoleClient();
  const [orgs, projects, profiles, developers] = await Promise.all([
    db.from("orgs").select("id, name_ru, website, created_at").eq("kind", "developer").order("created_at", { ascending: false }),
    db.from("catalog_projects").select("org_id"),
    db.from("profiles").select("org_id").eq("role", "partner"),
    db.from("developers").select("id,code,name_en,name_ru,website,org_id,admin_revision").order("name_en"),
  ]);
  if (orgs.error || projects.error || profiles.error) throw new Error("Не удалось загрузить организации и связи. Повторите загрузку страницы.");
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
      {developers.error ? <p role="alert" className="adm-msg err">Не удалось загрузить редактор справочника. Проверьте подключение и применение миграции редактора застройщиков. Приглашения ниже работают отдельно.</p> : <DeveloperDirectory developers={(developers.data ?? []) as DirectoryDeveloper[]} orgs={(orgs.data ?? []) as { id: string; name_ru: string }[]} />}
      <h2>Доступ в кабинет партнёра</h2>
      <p className="adm-lead">Здесь создаются организации партнёров и приглашения в личный кабинет. Застройщика для публичной карточки выбирайте в <Link href="/admin/projects">проекте → «Основное»</Link>. Приглашение само по себе не связывает справочник застройщиков с проектом.</p>
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

