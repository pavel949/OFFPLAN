import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseServiceConfig, createServiceRoleClient } from "@/lib/supabase/service";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <div className="p-6">
        <h1 className="serif text-2xl mb-2">Аккаунт</h1>
        <p className="text-[var(--muted)] text-sm">
          Настройте Supabase (NEXT_PUBLIC_SUPABASE_URL, ANON KEY) для входа и
          избранного.
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

  let favorites: { project_id: string }[] = [];
  if (hasSupabaseServiceConfig()) {
    try {
      const admin = createServiceRoleClient();
      const { data } = await admin
        .from("favorites")
        .select("project_id")
        .eq("user_id", user.id);
      favorites = data ?? [];
    } catch {
      favorites = [];
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="serif text-2xl mb-2">Личный кабинет</h1>
      <p className="text-[var(--muted)] text-sm mb-4">{user.email}</p>
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
        Избранное
      </h2>
      {favorites.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Пока пусто. В каталоге (войдите в аккаунт) сердечко синхронизирует
          избранное с этой страницей.
        </p>
      ) : (
        <ul className="text-sm font-mono space-y-1">
          {favorites.map((f) => (
            <li key={f.project_id}>{f.project_id}</li>
          ))}
        </ul>
      )}
      <p className="mt-6">
        <Link href="/" className="underline text-sm">
          ← Каталог
        </Link>
      </p>
    </div>
  );
}
