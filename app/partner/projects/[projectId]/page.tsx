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
