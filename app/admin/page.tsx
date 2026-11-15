import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { productionReadiness } from "@/lib/production-readiness";
import Link from "next/link";
import { leadStatsUnified, listLeadsUnified } from "@/lib/leads/unified";

const statusRu: Record<string, string> = {
  new: "Новые",
  contacted: "В работе",
  qualified: "Квалифицирован",
  closed: "Закрыт",
  lost: "Не целевой",
};

export default async function AdminDashboardPage() {
  if (!(await getAdminSessionOk())) return null;
  const stats = await leadStatsUnified();
  const recent = (await listLeadsUnified()).slice(0, 8);

  return (
    <div>
      <h1 className="serif text-2xl mb-1">Обзор</h1>
      <section className="adm-card"><h2>С чего начать</h2><p>Изменить каталог: <Link href="/admin/projects">откройте проект</Link>. Обработать обращение: <Link href="/admin/leads">заявки клиентов</Link>.</p><p><Link href="/admin/guide">Что и где редактировать, что увидит покупатель →</Link></p></section>
      <div className="flex flex-wrap gap-3 mb-6 text-sm">
        <Link className="admin-btn py-2 px-3 no-underline" href="/admin/projects">
          Проекты каталога
        </Link>
        <Link className="admin-nav-out py-2 px-3 no-underline" href="/admin/settings">
          Методология и шапка
        </Link>
        <Link className="admin-nav-out py-2 px-3 no-underline" href="/admin/ingest/whatsapp">
          Импорт WhatsApp
        </Link>
      </div>
      <p className="text-[var(--txt2)] text-sm mb-6">
        Заявки с сайта и статусы обработки. Новые заявки требуют ответа менеджера.
      </p>

      {!productionReadiness().find(c => c.id === "email")?.ready && (
        <p role="status" className="admin-err mb-4">Уведомления по email ещё не подключены. Проверяйте новые заявки здесь вручную. <Link href="/admin/readiness">Проверить настройки</Link></p>
      )}
      <div className="admin-stat-grid">
        <div className="admin-stat">
          <div className="admin-stat-v">{stats.total}</div>
          <div className="admin-stat-l">Всего лидов</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat-v">{stats.newCount}</div>
          <div className="admin-stat-l">Новые (требуют ответа)</div>
        </div>
        {(Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map(
          (k) => (
            <div key={k} className="admin-stat">
              <div className="admin-stat-v">{stats.byStatus[k]}</div>
              <div className="admin-stat-l">{statusRu[k] ?? k}</div>
            </div>
          ),
        )}
      </div>

      <h2 className="serif text-lg mb-3">Последние заявки</h2>
      {recent.length === 0 ? (
        <p className="text-[var(--txt2)] text-sm">
          Пока нет заявок. Форма на сайте — кнопка «Заявка» в шапке и на
          карточках проектов.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Имя</th>
                <th>Контакт</th>
                <th>Проект</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id}>
                  <td>
                    {new Date(l.createdAt).toLocaleString("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <Link href={`/admin/leads/${l.id}`}>{l.name}</Link>
                  </td>
                  <td>
                    <div>{l.email}</div>
                    {l.phone ? (
                      <div className="text-[var(--txt2)] text-xs">{l.phone}</div>
                    ) : null}
                  </td>
                  <td>{l.projectName ?? "—"}</td>
                  <td>
                    <span className={`admin-badge ${l.status}`}>
                      {statusRu[l.status] ?? l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6">
        <Link
          href="/admin/leads"
          className="text-[var(--ink)] font-semibold underline underline-offset-2"
        >
          Все лиды →
        </Link>
      </p>
    </div>
  );
}

