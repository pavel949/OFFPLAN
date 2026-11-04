export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/catalog";
import { developerSlug, summarizeDevelopers } from "@/lib/developers";
import { GUIDE } from "@/lib/guide-content";
import { projectSlug } from "@/lib/slug";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const projects = await getProjects();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/registry`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/developers`, changeFrequency: "weekly" as const, priority: 0.7 },
    ...["", "/problems", "/how-it-works", "/contact", "/representative"].map((x) => ({
      url: `${base}/protection${x}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/guide`, changeFrequency: "monthly" as const, priority: 0.6 },
    ...GUIDE.map((a) => ({ url: `${base}/guide/${a.slug}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...summarizeDevelopers(projects).map((d) => ({
      url: `${base}/developers/${developerSlug(d.code)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...projects.map((p) => ({
      url: `${base}/project/${projectSlug(p)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
