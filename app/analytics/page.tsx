export const dynamic = "force-dynamic";
import { PageIntro } from "@/components/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AnalyticsExplorer } from "@/components/ie/AnalyticsExplorer";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { getProjects } from "@/lib/catalog";
import { getRegionMeta, locationSlug, metaFor } from "@/lib/locations";
import { projectSlug } from "@/lib/slug";

export const metadata: Metadata = {
  title: "Аналитика рынка новостроек Пхукета — Ignatev Estate",
  description: "Все данные по новостройкам острова: проекты, локации, застройщики, цены, сроки сдачи и доходность. Фильтры и выгрузка в CSV.",
  alternates: { canonical: "/analytics" },
};

export default async function AnalyticsPage() {
  const [projects, regions] = await Promise.all([getProjects(), getRegionMeta()]);
  const locNames: Record<string, string> = {};
  const rows = projects.map((p) => {
    const slug = locationSlug(p.zone);
    const meta = metaFor(p.zone, regions);
    locNames[slug] = meta.nameRu;
    return {
      id: p.id, n: p.n, dev: p.dev, dt: p.dt, zone: p.zone, type: p.type, stK: p.stK, pN: p.pN, pT: p.pT,
      sqmP: p.sqmP, units: p.units, yN: p.yN, compY: p.compY, compQ: p.compQ,
      slug, locRu: meta.nameRu, href: `/project/${projectSlug(p)}`,
    };
  });
  return (
    <div className="ie-page">
      <SiteHeader />
      <PageIntro eyebrow="Данные каталога" title="Рынок в деталях" description="Сравнивайте проекты по локации, цене и срокам. Показатели относятся только к данным каталога; пропуски и размер выборки указаны отдельно." breadcrumbs={<><Link href="/">Каталог</Link><span>/</span><span>Аналитика</span></>} />
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <AnalyticsExplorer rows={rows} locNames={locNames} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
