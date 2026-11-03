import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { daysSince, freshnessOf, summarizeFreshness } from "@/lib/inventory/freshness";
import { InventoryClient } from "./inventory-client";

export default async function PartnerInventoryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <p className="text-[var(--muted)]">Настройте Supabase</p>;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");
  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.org_id || prof.role !== "partner") redirect("/partner");
  const { data: row } = await supabase
    .from("catalog_projects")
    .select("id, slug, org_id, data_confirmed_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!row || row.org_id !== prof.org_id) notFound();
  const { data: units } = await supabase
    .from("project_units")
    .select("id, label, bedrooms, floor, sqm, price_thb, currency, status, source, price_updated_at")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  const now = Date.now();
  const list = (units ?? []).map((u) => ({
    ...u,
    fresh: freshnessOf(u.price_updated_at as string | null, now),
    ageDays: daysSince(u.price_updated_at as string | null, now),
  }));
  const sum = summarizeFreshness(
    list.map((u) => ({ price_updated_at: u.price_updated_at as string | null, status: u.status as string })),
    now,
  );

  return (
    <div className="max-w-4xl">
      <p className="mb-4">
        <Link
          href={`/partner/projects/${projectId}`}
          className="text-sm text-[var(--muted)] underline"
        >
          ← Проект
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Прайс-лист и инвентарь</h1>
      <p className="text-[var(--muted)] text-sm mb-4">
        Данные видны покупателям в публичном каталоге. Цены старше 14 дней помечаются как
        требующие подтверждения, старше 30 дней — скрываются до подтверждения.
      </p>
      <p className="text-sm mb-6">
        Активных лотов: <b>{sum.active}</b> · актуальны: <b>{sum.fresh}</b> · требуют подтверждения:{" "}
        <b style={{ color: sum.stale ? "var(--amb)" : undefined }}>{sum.stale}</b> · цены скрыты:{" "}
        <b style={{ color: sum.expired ? "var(--red)" : undefined }}>{sum.expired}</b>
        {row.data_confirmed_at
          ? ` · подтверждено ${new Date(row.data_confirmed_at as string).toLocaleDateString("ru-RU")}`
          : " · ещё не подтверждалось"}
      </p>
      <InventoryClient
        projectId={row.id as string}
        units={list.map((u) => ({
          id: u.id as string,
          label: u.label as string,
          bedrooms: u.bedrooms as number | null,
          floor: u.floor as number | null,
          sqm: u.sqm as number | null,
          price_thb: u.price_thb as number | null,
          currency: (u.currency as string) ?? "THB",
          status: u.status as string,
          source: (u.source as string) ?? "developer",
          fresh: u.fresh,
          ageDays: u.ageDays,
        }))}
      />
    </div>
  );
}
