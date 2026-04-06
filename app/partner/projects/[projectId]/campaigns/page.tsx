import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CampaignsClient } from "./campaigns-client";

export default async function PartnerCampaignsPage({
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
  if (!user) redirect("/partner/login");

  const { data: prof } = await supabase
    .from("profiles")
    .select("org_id, role, partner_role")
    .eq("id", user.id)
    .maybeSingle();

  if (!prof?.org_id) redirect("/partner");

  const { data: row } = await supabase
    .from("catalog_projects")
    .select("id, slug, org_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!row || row.org_id !== prof.org_id) notFound();

  const { data: campaigns } = await supabase
    .from("sales_campaigns")
    .select("id, kind, starts_at, ends_at, label_en, label_ru")
    .eq("project_id", projectId)
    .order("starts_at", { ascending: false });

  const canEditCampaigns = prof.partner_role !== "sales";

  return (
    <div className="max-w-3xl">
      <p className="mb-4">
        <Link
          href={`/partner/projects/${projectId}`}
          className="text-sm text-[var(--muted)] underline"
        >
          ← Проект {row.slug}
        </Link>
      </p>
      <h1 className="serif text-2xl mb-2">Кампании и старты</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Launch / sale — публичные бейджи на карточке проекта (дорожная карта фазы 4).
      </p>
      <CampaignsClient
        projectId={projectId}
        campaigns={campaigns ?? []}
        canEdit={canEditCampaigns}
      />
    </div>
  );
}
