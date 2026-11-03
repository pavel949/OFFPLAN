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

  // Org-level inventory health (view respects RLS; missing before the migration is applied).
  const { data: inv } = prof?.org_id
    ? await supabase
        .from("org_active_units")
        .select("active_units, expired_units, last_price_update")
        .eq("org_id", prof.org_id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <h1 className="serif text-2xl mb-2">Кабинет застройщика</h1>
      <p className="text-[var(--muted)] text-sm mb-4">
        {prof?.full_name || user.email}
      </p>
      {inv ? (
        <p
          className="text-sm mb-4 rounded-lg border border-[var(--bdr)] p-3"
          style={{ borderColor: Number(inv.expired_units) > 0 ? "var(--red)" : undefined }}
        >
          Активных лотов: <b>{Number(inv.active_units)}</b>
          {Number(inv.expired_units) > 0 ? (
            <>
              {" "}
              · <b style={{ color: "var(--red)" }}>{Number(inv.expired_units)}</b> с неподтверждёнными
              ценами старше 30 дней (в каталоге цены скрыты) — откройте «Прайс-лист и инвентарь» в
              проекте и подтвердите актуальность.
            </>
          ) : (
            " · все цены актуальны."
          )}
        </p>
      ) : null}
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
          <Link href="/partner/deals" className="underline font-semibold">
            Сделки и комиссии
          </Link>{" "}
          (для брокеров — <Link href="/broker" className="underline">кабинет брокера</Link>)
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
