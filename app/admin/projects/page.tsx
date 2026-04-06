import Link from "next/link";
import { adminListProjects } from "@/app/actions/admin-brain";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

export default async function AdminProjectsPage() {
  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <h1 className="serif text-2xl mb-1">Проекты</h1>
        <p className="text-[var(--red)] text-sm">
          Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении.
        </p>
      </div>
    );
  }

  let rows: Awaited<ReturnType<typeof adminListProjects>> = [];
  let err: string | null = null;
  try {
    rows = await adminListProjects();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Проекты каталога</h1>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-2xl">
        Редактирование JSON-карточки (все поля: рейтинг <code>rat</code>, риск{" "}
        <code>risk</code>, рекомендация <code>rec</code>, описание и т.д.), загрузка
        документов. Изменения вступают в силу для сайта, когда запись опубликована в
        Supabase (см. модерацию).
      </p>

      {err ? (
        <p className="text-[var(--red)] text-sm mb-4">{err}</p>
      ) : null}

      {rows.length === 0 && !err ? (
        <p className="text-[var(--txt2)] text-sm">
          Нет строк в <code>catalog_projects</code>. Выполните{" "}
          <code>npm run seed:catalog</code> или импорт.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Legacy id</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="font-mono text-xs">{r.slug}</td>
                  <td className="tabular-nums">{r.legacy_id ?? "—"}</td>
                  <td>{r.moderation_status}</td>
                  <td>
                    <Link
                      href={`/admin/projects/${r.id}`}
                      className="font-semibold text-[var(--ink)] underline underline-offset-2"
                    >
                      Редактировать
                    </Link>
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
