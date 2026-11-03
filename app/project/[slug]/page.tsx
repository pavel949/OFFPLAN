export const dynamic = "force-dynamic";
import { createAnonClient, hasSupabasePublicConfig } from "@/lib/supabase/anon";
import { getPublicProjectFacts } from "@/lib/project-facts-query";
import { notFound, redirect } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";
import { getProjectByLegacyId } from "@/lib/catalog";
import { getProjectExtrasByLegacyId } from "@/lib/project-queries";
import { parseLegacyIdFromSlug, projectSlug } from "@/lib/slug";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const legacyId = parseLegacyIdFromSlug(slug);
  if (legacyId == null) return { title: "Project" };
  const project = await getProjectByLegacyId(legacyId);
  if (!project) return { title: "Project" };
  return {
    title: `${project.n} — Ignatev Estate`,
    description: project.desc.slice(0, 160),
    alternates: { canonical: `/project/${projectSlug(project)}` },
    openGraph: {
      title: `${project.n} — Ignatev Estate`,
      description: project.desc.slice(0, 160),
      type: "article",
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const legacyId = parseLegacyIdFromSlug(slug);
  if (legacyId == null) notFound();

  const project = await getProjectByLegacyId(legacyId);
  if (!project) notFound();

  const canonical = projectSlug(project);
  if (slug !== canonical) {
    redirect(`/project/${canonical}`);
  }

  const extras = await getProjectExtrasByLegacyId(legacyId);

  const { data: identity } =
    extras.catalogProjectId && hasSupabasePublicConfig()
      ? await createAnonClient()
          .from("public_catalog_projects")
          .select("developer_id")
          .eq("id", extras.catalogProjectId)
          .maybeSingle()
      : { data: null };
  const facts = await getPublicProjectFacts(
    extras.catalogProjectId,
    identity?.developer_id ?? null,
  );
  return (
    <ProjectDetailClient
      project={project}
      extras={extras}
      facts={facts}
      backHref="/"
      legacyId={legacyId}
    />
  );
}
