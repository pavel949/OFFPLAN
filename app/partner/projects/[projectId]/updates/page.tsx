import { ProjectTabs } from "@/components/partner/ProjectTabs";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatesClient } from "./updates-client";

export default async function PartnerUpdatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <p className="pt-warn">Кабинет временно недоступен. Напишите нам, мы поможем.</p>;
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
    .select("id, org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!row || row.org_id !== prof.org_id) notFound();
  const { data: list } = await supabase
    .from("project_updates")
    .select("id, kind, title_en, title_ru, published_at")
    .eq("project_id", projectId)
    .order("published_at", { ascending: false })
    .limit(50);
  return (
    <div className="max-w-2xl">
      <ProjectTabs projectId={projectId} active="/updates" />
      <h2 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Новости со стройки</h2>
      <p className="text-[var(--muted)] text-sm mb-6">
        Публикации видны на публичной странице проекта.
      </p>
      <UpdatesClient projectId={row.id} initialList={list ?? []} />
    </div>
  );
}