export const dynamic = "force-dynamic";
import { createAnonClient, hasSupabasePublicConfig } from "@/lib/supabase/anon";
import { getPublicProjectFacts } from "@/lib/project-facts-query";
import { notFound, redirect } from "next/navigation";
import { ProjectPage as ProjectView } from "@/components/ie/ProjectPage";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { developerSlug } from "@/lib/developers";
import { getDevelopers } from "@/lib/home-feed";
import { getProjectByLegacyId } from "@/lib/catalog";
import { getProjectExtrasByLegacyId } from "@/lib/project-queries";
import { parseLegacyIdFromSlug, projectSlug } from "@/lib/slug";
import { getPublicSales } from "@/lib/sales-public-query";

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
  const sales = extras.catalogProjectId ? await getPublicSales(extras.catalogProjectId) : null;

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
  const devRows = await getDevelopers();
  const developer = {
    slug: developerSlug(project.dt),
    name: project.dev,
    website: devRows[project.dt]?.website ?? null,
  };
  return (
    <>
      <SiteHeader />
      <ProjectView
        project={project}
        extras={extras}
        facts={facts}
        developer={developer}
        legacyId={legacyId}
        sales={sales}
      />
      <SiteFooter />
    </>
  );
}
