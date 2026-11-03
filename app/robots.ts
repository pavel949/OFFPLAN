import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/project/", "/registry", "/privacy"], disallow: ["/admin", "/partner", "/account", "/api/", "/registry/review", "/broker"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
