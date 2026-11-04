import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProjectDraftForm } from "./project-draft-form";

export default async function PartnerProjectEditPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <div>
        <p className="text-[var(--muted)]">Настройте Supabase в .env.local</p>
        <Link href="/partner">Назад</Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/partner/login");
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role, partner_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.org_id) {
    redirect("/partner");
  }

  const { data: row } = await supabase
    .from("catalog_projects")
    .select("id, slug, org_id, payload, draft_payload, moderation_status")
    .eq("id", projectId)
    .maybeSingle();

  if (!row || row.org_id !== prof.org_id) {
    notFound();
  }

  const draftSource = row.draft_payload ?? row.payload;
  const initialJson = JSON.stringify(draftSource, null, 2);

  const { count: pendingCount } = await supabase
    .from("moderation_submissions")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .eq("status", "pending");

  const cnt = async (table: string, extra?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if (extra) q = extra(q);
    const { count } = await q;
    return count ?? 0;
  };
  const [units, photosPub, photosPend, news, links, promos] = await Promise.all([
    cnt("project_units"),
    cnt("project_evidence", (q) => q.eq("kind", "photo").eq("status", "published")),
    cnt("project_evidence", (q) => q.eq("kind", "photo").eq("status", "pending")),
    cnt("project_updates"),
    cnt("project_sources"),
    cnt("sales_campaigns"),
  ]);
  const checklist = [
    { done: units > 0, label: `Инвентарь и цены: ${units} лот.`, href: "inventory", hint: "Вставьте таблицу из Excel: проверка до записи" },
    { done: photosPub > 0, label: `Фото: ${photosPub} опубл.${photosPend ? `, ${photosPend} на проверке` : ""}`, href: "facts", hint: "Загрузите файлы с подписью и датой съёмки" },
    { done: links > 0, label: `Ссылки и материалы: ${links}`, href: "materials", hint: "Сайт проекта, прайс-лист, брошюра, рендеры" },
    { done: news > 0, label: `Новости со стройки: ${news}`, href: "updates", hint: "Хотя бы одна запись о ходе работ" },
    { done: promos > 0, label: `Акции: ${promos}`, href: "campaigns", hint: "Необязательно, но повышает интерес" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const moderationLocked = (pendingCount ?? 0) > 0;
  const canEditDraft = prof?.partner_role !== "sales";

  return (
    <div className="max-w-2xl">
      <p className="mb-4">
        <Link
          href="/partner/projects"
          className="text-sm text-[var(--muted)] underline"
        >
          ← Все проекты
        </Link>
      </p>
      <h1 className="serif text-2xl mb-1">{row.slug}</h1>
      <div className="flex flex-wrap gap-3 mb-6 text-sm">
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/materials`}
        >
          Материалы и ссылки
        </Link>
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/facts`}
        >
          Фото, инфраструктура, расходы
        </Link>
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/inventory`}
        >
          Инвентарь и цены
        </Link>
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/verification`}
        >
          Верификация
        </Link>
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/updates`}
        >
          Новости / стройка
        </Link>
        <Link
          className="underline font-semibold"
          href={`/partner/projects/${projectId}/campaigns`}
        >
          Кампании
        </Link>
      </div>
      <section className="rounded-lg border border-[var(--bdr)] p-4 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2">
          Заполненность проекта: {doneCount} из {checklist.length}
        </h2>
        <ul className="space-y-1.5 text-sm">
          {checklist.map((c) => (
            <li key={c.href} className="flex gap-2">
              <span aria-hidden>{c.done ? "✅" : "⬜"}</span>
              <span>
                <Link className="underline font-semibold" href={`/partner/projects/${projectId}/${c.href}`}>
                  {c.label}
                </Link>
                {!c.done ? <span className="text-[var(--muted)]"> · {c.hint}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-[var(--muted)] text-sm mb-4">
        Статус: <strong>{row.moderation_status}</strong>
      </p>
      {moderationLocked ? (
        <p className="text-sm text-[var(--amb)] mb-6 rounded-lg border border-[var(--bdr)] bg-[var(--gpale)] px-3 py-2">
          Есть заявка на модерации — редактирование заблокировано до решения IE.
        </p>
      ) : null}
      {!canEditDraft ? (
        <p className="text-sm text-[var(--muted)] mb-4 rounded border border-[var(--bdr)] px-3 py-2">
          Роль sales: редактирование JSON каталога недоступно — используйте
          инвентарь и новости.
        </p>
      ) : null}
      <ProjectDraftForm
        projectId={row.id}
        initialJson={initialJson}
        readOnly={moderationLocked || !canEditDraft}
      />
    </div>
  );
}
