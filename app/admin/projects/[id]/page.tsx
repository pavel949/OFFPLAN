import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetProjectPayload, adminListProjectDocuments } from "@/app/actions/admin-brain";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { ProjectDocsSection } from "../project-docs-section";
import { ProjectPayloadForm } from "../project-payload-form";

export default async function AdminProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!hasSupabaseServiceConfig()) {
    return (
      <div>
        <p className="text-[var(--red)] text-sm">Настройте Supabase (service role).</p>
        <Link href="/admin/projects">Назад</Link>
      </div>
    );
  }

  let payloadJson = "";
  let slug = "";
  let moderation = "";
  let docs: Awaited<ReturnType<typeof adminListProjectDocuments>> = [];

  try {
    const p = await adminGetProjectPayload(id);
    slug = p.slug;
    moderation = p.moderation_status;
    payloadJson = JSON.stringify(p.payload, null, 2);
    docs = await adminListProjectDocuments(id);
  } catch {
    notFound();
  }

  return (
    <div>
      <p className="mb-4">
        <Link href="/admin/projects" className="text-sm text-[var(--txt2)] underline">
          ← Все проекты
        </Link>
      </p>
      <h1 className="serif text-2xl mb-1">{slug}</h1>
      <p className="text-[var(--txt2)] text-sm mb-2">
        Статус модерации: <strong>{moderation}</strong> · id:{" "}
        <span className="font-mono text-xs">{id}</span>
      </p>
      <p className="text-[var(--txt2)] text-sm mb-6">
        Публичная страница:{" "}
        <Link href={`/project/${slug}`} className="underline font-semibold" target="_blank">
          /project/{slug}
        </Link>
      </p>

      <ProjectPayloadForm projectId={id} initialJson={payloadJson} />
      <ProjectDocsSection projectId={id} initialDocs={docs} />
    </div>
  );
}
