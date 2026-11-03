import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "";
  return {
    rules: [{ userAgent: "*", allow: ["/", "/project/", "/privacy"], disallow: ["/admin", "/partner", "/account", "/api/"] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
