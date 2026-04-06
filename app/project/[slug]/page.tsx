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

  return (
    <ProjectDetailClient
      project={project}
      extras={extras}
      backHref="/"
      legacyId={legacyId}
    />
  );
}
