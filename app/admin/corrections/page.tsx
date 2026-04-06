import Link from "next/link";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";
import { CloseCorrectionButton, GrantCorrectionButton } from "./correction-actions";

const statusRu: Record<string, string> = {
  open: "Открыт",
  granted: "Доступ выдан",
  closed: "Закрыт",
};

export default async function AdminCorrectionsPage() {
  let rows: {
    id: string;
    project_id: string;
    org_id: string;
    message: string;
    status: string;
    created_at: string;
    admin_note: string;
  }[] = [];

  if (hasSupabaseServiceConfig()) {
    try {
      const supabase = createServiceRoleClient();
      const { data } = await supabase
        .from("correction_requests")
        .select("id, project_id, org_id, message, status, created_at, admin_note")
        .order("created_at", { ascending: false })
        .limit(200);
      rows = (data ?? []) as typeof rows;
    } catch {
      rows = [];
    }
  }

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Запросы правок</h1>
      <p className="text-[var(--txt2)] text-sm mb-6 max-w-xl">
        Застройщик сообщает о неточности в карточке IE. После «выдачи доступа»
        проект привязывается к организации, в черновик копируется опубликованный
        payload — дальше правки и модерация как обычно.
      </p>
      {!hasSupabaseServiceConfig() ? (
        <p className="text-[var(--red)] text-sm">
          Supabase не настроен — задайте NEXT_PUBLIC_SUPABASE_URL и
          SUPABASE_SERVICE_ROLE_KEY.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">Нет запросов.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Проект (UUID)</th>
                <th>Текст</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="font-mono text-xs">{r.project_id}</td>
                  <td className="text-xs max-w-xs">
                    <span className="line-clamp-3">{r.message}</span>
                    {r.admin_note ? (
                      <span className="block text-[var(--txt2)] mt-1">
                        IE: {r.admin_note}
                      </span>
                    ) : null}
                  </td>
                  <td>{statusRu[r.status] ?? r.status}</td>
                  <td className="space-y-1">
                    {r.status === "open" ? (
                      <GrantCorrectionButton requestId={r.id} />
                    ) : null}
                    {r.status !== "closed" ? (
                      <CloseCorrectionButton requestId={r.id} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-6">
        <Link
          href="/admin/moderation"
          className="text-[var(--ink)] font-semibold underline underline-offset-2"
        >
          ← Очередь модерации черновиков
        </Link>
      </p>
    </div>
  );
}
