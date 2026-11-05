import { adminPendingSalesReviews } from "@/app/actions/sales-model";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import Link from "next/link";
import { hasSupabaseServiceConfig, createServiceRoleClient } from "@/lib/supabase/service";

export default async function AdminModerationPage() {
  if (!(await getAdminSessionOk())) return null;
  let rows: {
    id: string;
    entity_type: string;
    entity_id: string;
    status: string;
    created_at: string;
    reviewer_note: string;
  }[] = [];

  if (hasSupabaseServiceConfig()) {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("moderation_submissions")
        .select("id, entity_type, entity_id, status, created_at, reviewer_note")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error("Не удалось загрузить очередь");
      rows = (data ?? []) as typeof rows;
  }

  const salesReviews = hasSupabaseServiceConfig() ? await adminPendingSalesReviews() : [];

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Модерация</h1>
      <section className="adm-card"><h2>Условия продажи от застройщиков</h2><p>Внутренние версии не меняют предложения для покупателей до отдельной публикации.</p>{salesReviews.length ? <ul>{salesReviews.map(r => <li key={r.projectId}><Link href={`/admin/projects/${r.projectId}?tab=sales`}>{r.name} · версия {r.revision}</Link> · {new Date(r.createdAt).toLocaleDateString("ru-RU")}</li>)}</ul> : <p>Новых версий на проверку нет.</p>}</section>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-xl">
        Очередь черновиков застройщиков: diff и решение на странице заявки.
        Запросы правок по карточкам IE — в разделе{" "}
        <Link href="/admin/corrections" className="underline font-semibold">
          Правки
        </Link>
        .
      </p>
      {!hasSupabaseServiceConfig() ? (
        <p className="text-[var(--red)] text-sm">
          Supabase не настроен — задайте NEXT_PUBLIC_SUPABASE_URL и
          SUPABASE_SERVICE_ROLE_KEY.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">Нет записей в очереди.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>ID сущности</th>
                <th>Статус</th>
                <th>Комментарий</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td>{r.entity_type}</td>
                  <td className="font-mono text-xs">{r.entity_id}</td>
                  <td>{r.status}</td>
                  <td>{r.reviewer_note || "—"}</td>
                  <td>
                    <Link
                      href={`/admin/moderation/${r.id}`}
                      className="font-semibold text-[var(--ink)] underline underline-offset-2"
                    >
                      Открыть
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
