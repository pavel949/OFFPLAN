import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGetProjectPayload, adminListInterests, adminListProjectDocuments } from "@/app/actions/admin-brain";
import { adminAddSource, adminConfirmSource, adminDeleteSource, adminListSources } from "@/app/actions/project-sources";
import { SourcesManager } from "@/components/portal/SourcesManager";
import type { ProjectSourceRow } from "@/lib/sources";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";
import { InterestsSection } from "../interests-section";
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
  let sources: ProjectSourceRow[] = [];
  let interests: Awaited<ReturnType<typeof adminListInterests>> = { interests: [], brokers: [] };

  try {
    const p = await adminGetProjectPayload(id);
    slug = p.slug;
    moderation = p.moderation_status;
    payloadJson = JSON.stringify(p.payload, null, 2);
    docs = await adminListProjectDocuments(id);
    sources = await adminListSources(id).catch(() => []);
    interests = await adminListInterests(id).catch(() => interests);
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

      <p className="mb-6">
        <Link href={`/admin/projects/${id}/inventory`} className="admin-btn inline-block py-2 px-3">
          Прайс-лист и инвентарь →
        </Link>
      </p>

      <ProjectPayloadForm projectId={id} initialJson={payloadJson} />
      <section className="mt-8">
        <h2 className="serif text-lg mb-2">Материалы застройщика (ссылки)</h2>
        <SourcesManager
          projectId={id}
          sources={sources}
          api={{ add: adminAddSource, remove: adminDeleteSource, confirm: adminConfirmSource }}
        />
      </section>
      <ProjectDocsSection projectId={id} initialDocs={docs} />
      <InterestsSection projectId={id} interests={interests.interests} brokers={interests.brokers} />
    </div>
  );
}
