import { getAdminSessionOk } from "@/lib/admin-server-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { diffJsonObjects } from "@/lib/json-diff";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "@/lib/supabase/service";
import { ModerationReviewActions } from "./moderation-review-actions";

export default async function AdminModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getAdminSessionOk())) return null;
  const { id } = await params;

  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <p className="text-[var(--red)] text-sm">Supabase не настроен.</p>
        <Link href="/admin/moderation">Назад</Link>
      </div>
    );
  }

  const supabase = createServiceRoleClient();
  const { data: sub, error: subError } = await supabase
    .from("moderation_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (subError) throw new Error("Не удалось загрузить заявку на модерацию");
  if (!sub) {
    notFound();
  }

  let title = sub.entity_id;
  if (sub.entity_type === "project") {
    const { data: p } = await supabase
      .from("catalog_projects")
      .select("slug")
      .eq("id", sub.entity_id)
      .maybeSingle();
    if (p?.slug) title = p.slug;
  } else if (sub.entity_type === "org") {
    const { data: o } = await supabase
      .from("orgs")
      .select("slug")
      .eq("id", sub.entity_id)
      .maybeSingle();
    if (o?.slug) title = o.slug;
  }

  const baseline = sub.baseline_snapshot ?? {};
  const after = sub.snapshot ?? {};
  const rows = diffJsonObjects(baseline, after);
  const canApprove = sub.status === "pending";

  return (
    <div>
      <p className="mb-4">
        <Link
          href="/admin/moderation"
          className="text-sm text-[var(--txt2)] underline"
        >
          ← Очередь модерации
        </Link>
      </p>
      <h1 className="serif text-2xl mb-1">Заявка</h1>
      <p className="text-[var(--txt2)] text-sm mb-2">
        Тип: <strong>{sub.entity_type}</strong> · {title}
      </p>
      <p className="text-[var(--txt2)] text-sm mb-6">
        Статус: <strong>{sub.status}</strong> ·{" "}
        {new Date(sub.created_at).toLocaleString("ru-RU")}
      </p>

      <h2 className="serif text-lg mb-2">Изменения (diff полей)</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--txt2)] mb-4">
          Нет отличий на уровне плоских полей (или пустой baseline для нового
          проекта). Полные JSON ниже.
        </p>
      ) : (
        <div className="admin-table-wrap mb-6">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Поле</th>
                <th>Было</th>
                <th>Стало</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path}>
                  <td className="font-mono text-xs align-top">{r.path}</td>
                  <td className="text-xs align-top max-w-[240px] break-words">
                    {r.before}
                  </td>
                  <td className="text-xs align-top max-w-[240px] break-words">
                    {r.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mb-4">
        <summary className="cursor-pointer text-sm font-semibold mb-2">
          Полный снимок (snapshot)
        </summary>
        <pre className="text-xs bg-[var(--sur)] border border-[var(--bdr)] rounded-lg p-3 overflow-x-auto max-h-80">
          {JSON.stringify(after, null, 2)}
        </pre>
      </details>

      {sub.baseline_snapshot ? (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm font-semibold mb-2">
            Baseline (опубликовано до заявки)
          </summary>
          <pre className="text-xs bg-[var(--sur)] border border-[var(--bdr)] rounded-lg p-3 overflow-x-auto max-h-80">
            {JSON.stringify(sub.baseline_snapshot, null, 2)}
          </pre>
        </details>
      ) : null}

      {canApprove ? (
        <ModerationReviewActions submissionId={sub.id} />
      ) : (
        <p className="text-sm text-[var(--txt2)]">
          Заявка уже обработана
          {sub.reviewer_note ? `: ${sub.reviewer_note}` : ""}.
        </p>
      )}
    </div>
  );
}
