export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/catalog";
import { projectSlug } from "@/lib/slug";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const projects = await getProjects();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/registry`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...projects.map((p) => ({
      url: `${base}/project/${projectSlug(p)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
