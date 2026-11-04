export const dynamic = "force-dynamic";
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
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Аналитика</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>Рынок новостроек</div>
          <h1>Аналитика</h1>
          <p>
            Все проекты каталога в одной таблице: сколько их, где и кем строятся, сколько стоят и когда сдаются. Фильтруйте по локации,
            типу, стадии, застройщику и году сдачи: показатели пересчитываются сразу. Любой проект, добавленный в каталог, попадает в
            расчёт автоматически.
          </p>
        </div>
      </section>
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <AnalyticsExplorer rows={rows} locNames={locNames} />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
