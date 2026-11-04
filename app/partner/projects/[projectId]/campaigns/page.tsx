import { ProjectTabs } from "@/components/partner/ProjectTabs";
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
        <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>
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
      <ProjectTabs projectId={projectId} active="/campaigns" />
      <h2 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Акции и старты продаж</h2>
      <p className="text-sm text-[var(--muted)] mb-6">
        Акции и старты продаж показываются бейджем на карточке проекта, пока они действуют.
      </p>
      <CampaignsClient
        projectId={projectId}
        campaigns={campaigns ?? []}
        canEdit={canEditCampaigns}
      />
    </div>
  );
}
