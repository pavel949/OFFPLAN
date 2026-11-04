import { ProjectTabs } from "@/components/partner/ProjectTabs";
import { notFound, redirect } from "next/navigation";
import {
  partnerAddSource,
  partnerConfirmSource,
  partnerDeleteSource,
} from "@/app/actions/project-sources";
import { partnerDriveImport, partnerDriveList } from "@/app/actions/drive-sync";
import { SourcesManager } from "@/components/portal/SourcesManager";
import type { ProjectSourceRow } from "@/lib/sources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MaterialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await createSupabaseServerClient();
  if (!db) redirect("/partner");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: p } = await db
    .from("catalog_projects")
    .select("id, slug")
    .eq("id", projectId)
    .maybeSingle();
  if (!p) notFound();

  const { data, error } = await db
    .from("project_sources")
    .select("id, project_id, kind, title, url, visibility, cadence, note, confirmed_at, created_at, sync_enabled, last_synced_at, last_sync_note")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <ProjectTabs projectId={projectId} active="/materials" />
      <h2 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Материалы проекта</h2>
      {error ? <p role="alert">Не удалось загрузить: {error.message}</p> : null}
      <SourcesManager
        projectId={projectId}
        sources={(data ?? []) as ProjectSourceRow[]}
        api={{ add: partnerAddSource, remove: partnerDeleteSource, confirm: partnerConfirmSource }}
        drive={{ list: partnerDriveList, run: partnerDriveImport }}
      />
    </div>
  );
}
