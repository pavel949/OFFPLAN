import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    .select("id, slug, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!row || row.org_id !== prof.org_id) notFound();
  const { data: units } = await supabase
    .from("project_units")
    .select("id, label, bedrooms, floor, sqm, price_thb, status, updated_at")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  return (
    <div className="max-w-3xl">
      <p className="mb-4">
        <Link
          href={`/partner/projects/${projectId}`}
          className="text-sm text-[var(--muted)] underline"
        >
          ← Проект
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Инвентарь (юниты)</h1>
      <p className="text-[var(--muted)] text-sm mb-6">
        Обновляйте цены и статусы регулярно — данные видны в публичном каталоге.
      </p>
      <InventoryClient
        projectId={row.id}
        units={units ?? []}
      />
    </div>
  );
}