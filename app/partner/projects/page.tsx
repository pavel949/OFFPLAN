import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const statusRu: Record<string, string> = {
  draft: "Черновик",
  pending_review: "На проверке",
  published: "Опубликован",
  rejected: "Отклонён",
};

export default async function PartnerProjectsPage() {
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
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.org_id) {
    return (
      <div>
        <p className="mb-4">
          <Link
            href="/partner"
            className="text-sm text-[var(--muted)] underline"
          >
            ← Кабинет
          </Link>
        </p>
        <p className="text-[var(--muted)] text-sm max-w-md">
          У профиля нет привязки к организации. Обратитесь в IE — после привязки
          здесь появятся ваши проекты.
        </p>
      </div>
    );
  }

  const { data: projects } = await supabase
    .from("catalog_projects")
    .select("id, slug, moderation_status, updated_at")
    .eq("org_id", prof.org_id)
    .order("slug");

  return (
    <div className="max-w-2xl">
      <p className="mb-4">
        <Link href="/partner" className="text-sm text-[var(--muted)] underline">
          ← Кабинет
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Мои проекты</h1>
      <Link className="underline" href="/partner/projects/new">
        Добавить проект
      </Link>
      <p className="text-[var(--muted)] text-sm mb-6">
        Редактируйте черновик JSON и отправляйте на модерацию IE. Публичный
        каталог показывает только опубликованную версию.
      </p>
      {!projects?.length ? (
        <p className="text-sm text-[var(--muted)]">
          Пока нет проектов в вашей организации. После онбординга IE добавит
          проект в Supabase.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/partner/projects/${p.id}`}
                className="font-semibold text-[var(--ink)] underline underline-offset-2"
              >
                {p.slug}
              </Link>
              <span className="text-[var(--muted)] text-xs ml-2">
                {statusRu[p.moderation_status] ?? p.moderation_status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
