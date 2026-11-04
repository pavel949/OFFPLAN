export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getProjects } from "@/lib/catalog";
import { developerSlug, summarizeDevelopers } from "@/lib/developers";
import { GUIDE } from "@/lib/guide-content";
import { locationSlug } from "@/lib/locations";
import { GEO } from "@/lib/geo-seed";
import { projectSlug } from "@/lib/slug";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const projects = await getProjects();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/registry`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/methodology`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/quick-assessment`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/locations`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${base}/analytics`, changeFrequency: "daily" as const, priority: 0.7 },
    ...[...new Set(projects.map((p) => locationSlug(p.zone)))].map((s) => ({
      url: `${base}/locations/${s}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${base}/countries`, changeFrequency: "weekly" as const, priority: 0.7 },
    ...GEO.map((c) => ({ url: `${base}/countries/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...GEO.flatMap((c) => c.regions.flatMap((r) => r.locations.map((l) => ({ url: `${base}/locations/${l.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })))),
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
