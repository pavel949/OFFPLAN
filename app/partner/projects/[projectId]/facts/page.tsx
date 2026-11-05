import { ProjectTabs } from "@/components/partner/ProjectTabs";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceForm } from "@/components/portal/EvidenceForm";
import { MediaEditor } from "@/components/portal/MediaEditor";
import type { ProjectEvidence } from "@/lib/project-evidence";
import { PhotoUploader } from "@/components/portal/PhotoUploader";
export default async function FactsPage({
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
    .select("id,slug")
    .eq("id", projectId)
    .maybeSingle();
  if (!p) notFound();
  const { data, error } = await db
    .from("project_evidence")
    .select("id,project_id,title,status,kind,fact_key,source_url,observed_at,details,reviewed_at")
    .eq("project_id", projectId)
    .order("submitted_at", { ascending: false });
  const {data: units} = await db.from("project_units").select("id,label").eq("project_id",projectId).order("label");
  return (
    <div className="space-y-5">
      <ProjectTabs projectId={projectId} active="/facts" />
      <h2 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>Фотографии и сведения о проекте</h2>
      {error ? (
        <p role="alert">Не удалось загрузить сведения: {error.message}</p>
      ) : null}
      <PhotoUploader projectId={projectId} units={units ?? []} />
      <section className="space-y-3"><h3>Управление опубликованной галереей</h3>{data?.filter(x=>x.kind === "photo" && x.status === "published").map(x=><MediaEditor key={x.id} item={x as ProjectEvidence} units={units ?? []}/>)}</section>
      <details className="rounded-lg border border-[var(--bdr)] p-4">
        <summary className="cursor-pointer text-sm font-bold">Добавить сведения: инфраструктура, расходы на содержание, стадия продаж</summary>
        <div className="mt-3">
          <EvidenceForm projectId={projectId} units={units ?? []} />
        </div>
      </details>
      <section className="adm-card">
        <h3>Отправленные сведения</h3>
        {data?.length ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
            {data.map((x) => (
              <li key={x.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span className={`adm-pill ${x.status === "published" ? "ok" : x.status === "rejected" ? "bad" : "warn"}`}>{({ published: "на сайте", pending: "на проверке", rejected: "отклонено", archived: "архив" } as Record<string, string>)[x.status] ?? x.status}</span>
                <span>{x.title}</span>
              </li>
            ))}
          </ul>
        ) : <p className="adm-hint">Пока ничего не отправлено.</p>}
      </section>
    </div>
  );
}
