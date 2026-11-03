import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PartnerDashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="serif text-2xl mb-2">Кабинет застройщика</h1>
        <p className="text-[var(--muted)] text-sm max-w-md">
          Укажите в .env.local переменные NEXT_PUBLIC_SUPABASE_URL и
          NEXT_PUBLIC_SUPABASE_ANON_KEY, затем войдите через{" "}
          <Link href="/partner/login" className="underline font-semibold">
            /partner/login
          </Link>
          .
        </p>
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
    .select("role, org_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      <h1 className="serif text-2xl mb-2">Кабинет застройщика</h1>
      <p className="text-[var(--muted)] text-sm mb-4">
        {prof?.full_name || user.email}
      </p>
      <ul className="list-disc pl-5 text-sm space-y-2">
        <li>
          Роль: <strong>{prof?.role ?? "—"}</strong>
        </li>
        <li>
          Организация:{" "}
          <strong>{prof?.org_id ?? "не привязана (свяжитесь с IE)"}</strong>
        </li>
        <li>
          <Link href="/partner/projects" className="underline font-semibold">
            Мои проекты и черновики
          </Link>
        </li>
        <li>
          <Link href="/partner/leads" className="underline font-semibold">
            Заявки по моим проектам
          </Link>
        </li>
        <li>
          <Link href="/partner/corrections" className="underline font-semibold">
            Запрос правок по карточке IE
          </Link>
        </li>
        <li>
          <Link href="/" className="underline">
            Публичный каталог
          </Link>
        </li>
      </ul>
    </div>
  );
}
