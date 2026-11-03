import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { reviewProjectEvidence } from "@/app/actions/project-evidence";
export default async function EvidenceReview() {
  if (!(await getAdminSessionOk()) || !hasSupabaseServiceConfig())
    return (
      <p>
        Для проверки нужны вход администратора и серверное подключение к базе.
      </p>
    );
  const { data, error } = await createServiceRoleClient()
    .from("project_evidence")
    .select("id,project_id,title,kind,source_url,observed_at,details")
    .eq("status", "pending")
    .order("submitted_at");
  if (error) return <p role="alert">{error.message}</p>;
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl">Проверка сведений проекта</h1>
      <p>
        Проверяйте источник, дату, права на фотографии и принадлежность сведений
        проекту. Одобрение заменит только опубликованную версию с тем же кодом;
        история сохранится.
      </p>
      {!data?.length ? (
        <p>Нет ожидающих проверки сведений.</p>
      ) : (
        data.map((x) => (
          <article className="border rounded p-4" key={x.id}>
            <h2>
              {x.title} · {x.kind}
            </h2>
            <p>
              Проект: {x.project_id} · {x.observed_at}
            </p>
            <a href={x.source_url} target="_blank" rel="noopener noreferrer">
              Открыть источник
            </a>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(x.details, null, 2)}
            </pre>
            <form action={reviewProjectEvidence}>
              <input type="hidden" name="id" value={x.id} />
              <button className="admin-btn" name="approve" value="yes">
                Проверено — опубликовать
              </button>
              <button className="admin-btn" name="approve" value="no">
                Отклонить
              </button>
            </form>
          </article>
        ))
      )}
    </div>
  );
}
