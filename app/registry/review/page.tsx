import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimForm } from "@/components/registry/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_RU: Record<string, string> = {
  submitted: "ждёт эксперта",
  in_review: "на проверке",
  changes_requested: "запрошены уточнения",
};

type Row = {
  id: string;
  target_level: number;
  status: string;
  submitted_at: string | null;
  assigned_reviewer: string | null;
  catalog_projects: { slug: string; payload: { n?: string } | null } | null;
  orgs: { name_ru: string } | null;
};

export default async function ReviewQueuePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <p style={{ padding: 24 }}>Supabase не настроен</p>;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/registry/login");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = prof?.role as string | undefined;
  if (!role || !["reviewer", "admin", "editor"].includes(role)) {
    return <p style={{ padding: 24 }}>Нет доступа: раздел только для экспертов реестра.</p>;
  }
  const canAct = role === "reviewer";

  const { data } = await supabase
    .from("verification_cases")
    .select("id, target_level, status, submitted_at, assigned_reviewer, catalog_projects(slug, payload), orgs(name_ru)")
    .in("status", ["submitted", "in_review", "changes_requested"])
    .order("submitted_at", { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as unknown as Row[];
  const mine = rows.filter((r) => r.assigned_reviewer === user.id);
  const queue = rows.filter((r) => r.status === "submitted");
  const others = rows.filter((r) => r.status !== "submitted" && r.assigned_reviewer !== user.id);

  const Table = ({ list, claim }: { list: Row[]; claim?: boolean }) =>
    list.length === 0 ? (
      <p className="text-sm" style={{ opacity: 0.7 }}>Пусто.</p>
    ) : (
      <table className="admin-table">
        <thead>
          <tr>
            <th>Проект</th>
            <th>Застройщик</th>
            <th>Уровень</th>
            <th>Статус</th>
            <th>Подана</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td>{r.catalog_projects?.payload?.n ?? r.catalog_projects?.slug}</td>
              <td>{r.orgs?.name_ru}</td>
              <td>L{r.target_level}</td>
              <td>{STATUS_RU[r.status] ?? r.status}</td>
              <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ru-RU") : "—"}</td>
              <td>
                <Link href={`/registry/review/${r.id}`} className="underline">Открыть</Link>
                {claim && canAct ? <ClaimForm caseId={r.id} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 16px" }}>
      <h1 className="serif text-2xl mb-1">Кабинет эксперта реестра</h1>
      <p className="text-sm mb-6" style={{ opacity: 0.75 }}>
        {canAct
          ? "Вы можете брать дела, проверять пункты и принимать решения (с учётом отвода и правила «четырёх глаз»)."
          : "Режим просмотра: администраторы платформы решений не принимают."}
      </p>
      <h2 className="text-sm font-bold uppercase tracking-wide mb-2">Мои дела</h2>
      <Table list={mine} />
      <h2 className="text-sm font-bold uppercase tracking-wide mt-8 mb-2">Очередь</h2>
      <Table list={queue} claim />
      <h2 className="text-sm font-bold uppercase tracking-wide mt-8 mb-2">Остальные открытые дела</h2>
      <Table list={others} />
    </main>
  );
}
