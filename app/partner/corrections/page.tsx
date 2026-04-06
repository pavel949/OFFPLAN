import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CorrectionForm } from "./correction-form";

const statusRu: Record<string, string> = {
  open: "На рассмотрении",
  granted: "Доступ к черновику выдан",
  closed: "Закрыт",
};

export default async function PartnerCorrectionsPage() {
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
    .select("org_id")
    .eq("id", user.id)
    .maybeSingle();

  type ReqRow = {
    id: string;
    project_id: string;
    message: string;
    status: string;
    created_at: string;
  };
  let myRequests: ReqRow[] = [];
  if (prof?.org_id) {
    const { data } = await supabase
      .from("correction_requests")
      .select("id, project_id, message, status, created_at")
      .eq("org_id", prof.org_id)
      .order("created_at", { ascending: false })
      .limit(20);
    myRequests = (data ?? []) as ReqRow[];
  }

  return (
    <div className="max-w-lg">
      <p className="mb-4">
        <Link href="/partner" className="text-sm text-[var(--muted)] underline">
          ← Кабинет
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Запрос правок</h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        Укажите UUID проекта в каталоге (из Supabase) и что неверно в данных IE.
        После выдачи доступа отредактируйте черновик в{" "}
        <Link href="/partner/projects" className="underline font-semibold">
          Мои проекты
        </Link>{" "}
        и отправьте на модерацию.
      </p>
      {myRequests && myRequests.length > 0 ? (
        <div className="mb-8 border border-[var(--bdr)] rounded-lg p-3 bg-[var(--sur)]">
          <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-2">
            Мои запросы
          </p>
          <ul className="space-y-2 text-sm">
            {myRequests.map((r) => (
              <li key={r.id} className="border-b border-[var(--bdr)] pb-2 last:border-0">
                <span className="text-[var(--muted)] text-xs">
                  {new Date(r.created_at).toLocaleString("ru-RU")}
                </span>
                <div className="font-mono text-xs mt-1">{r.project_id}</div>
                <div className="text-xs mt-1">
                  {r.message.length > 120
                    ? `${r.message.slice(0, 120)}…`
                    : r.message}
                </div>
                <div className="text-xs font-semibold mt-1">
                  {statusRu[r.status] ?? r.status}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <CorrectionForm />
    </div>
  );
}
