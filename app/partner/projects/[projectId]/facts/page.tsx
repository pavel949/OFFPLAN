import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceForm } from "@/components/portal/EvidenceForm";
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
    .select("id,title,status,kind")
    .eq("project_id", projectId)
    .order("submitted_at", { ascending: false });
  return (
    <div className="max-w-2xl space-y-5">
      <Link href={`/partner/projects/${projectId}`}>← Проект</Link>
      <h1 className="text-2xl">Фотографии, инфраструктура и расходы</h1>
      {error ? (
        <p role="alert">Не удалось загрузить сведения: {error.message}</p>
      ) : null}
      <EvidenceForm projectId={projectId} />
      <ul>
        {data?.map((x) => (
          <li key={x.id}>
            {x.title} · {x.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
