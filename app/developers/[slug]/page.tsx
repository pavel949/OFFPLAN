export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTile } from "@/components/ie/ProjectTile";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { getProjects } from "@/lib/catalog";
import { summarizeDevelopers } from "@/lib/developers";
import { getDevelopers, getHomeFeed } from "@/lib/home-feed";
import { effectiveLevel, LEVEL_TEXT } from "@/lib/registry/levels";
import { zoneLabel } from "@/lib/taxonomy";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const projects = await getProjects();
  const dev = summarizeDevelopers(projects).find((d) => d.slug === slug);
  return dev ?? null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const dev = await load(slug);
  if (!dev) return { title: "Застройщик — Ignatev Estate" };
  return {
    title: `${dev.name}: проекты и досье — Ignatev Estate`,
    description: `${dev.name}: ${dev.projects.length} проект. на Пхукете, юридические данные и статус проверки.`,
    alternates: { canonical: `/developers/${dev.slug}` },
  };
}

export default async function DeveloperPage({ params }: Params) {
  const { slug } = await params;
  const dev = await load(slug);
  if (!dev) notFound();
  const [feed, rows] = await Promise.all([getHomeFeed(), getDevelopers()]);
  const row = rows[dev.code];
  const best = Math.max(...dev.projects.map((p) => effectiveLevel(p.ver)));
  const availableTotal = dev.projects.reduce((s, p) => s + (feed.availability[p.id]?.available ?? 0), 0);
  const hasAvail = dev.projects.some((p) => feed.availability[p.id]?.available != null);
  const site = row?.website && /^https:\/\//.test(row.website) ? row.website : null;

  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs">
            <Link href="/">Каталог</Link> / <Link href="/developers">Застройщики</Link> / {dev.name}
          </div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>Досье застройщика</div>
          <h1>{dev.name}</h1>
          <p>
            {dev.projects.length} проект. · {dev.zones.slice(0, 4).map((z) => zoneLabel(z, "ru")).join(", ")}
            {dev.fromPriceM ? ` · цены от ฿${dev.fromPriceM}M` : ""}
          </p>
          <div className="ie-stats">
            <div className="ie-stat"><b>{dev.projects.length}</b><small>проектов</small></div>
            <div className="ie-stat"><b>{dev.completed}</b><small>сдано</small></div>
            <div className="ie-stat"><b>{dev.inProgress}</b><small>в работе</small></div>
            {hasAvail ? <div className="ie-stat"><b>{availableTotal}</b><small>лотов в опубликованных прайсах · неполный набор</small></div> : null}
            <div className="ie-stat"><b>L{best}</b><small>{LEVEL_TEXT[best as 0 | 1 | 2].ru}</small></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            {site ? (
              <a className="ie-btn ie-btn--gold" href={site} target="_blank" rel="noopener noreferrer nofollow">
                Сайт застройщика ↗
              </a>
            ) : null}
            <Link className="ie-btn ie-btn--ghost" href="/registry">Как мы проверяем</Link>
          </div>
        </div>
      </section>

      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Проекты</div>
              <h2>Что строит {dev.name}</h2>
            </div>
          </div>
          <div className="ie-grid">
            {dev.projects.map((p) => (
              <ProjectTile key={p.id} p={p} feed={feed} />
            ))}
          </div>
        </div>
      </section>

      <section className="ie-section ie-section--dark">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Юридические данные</div>
              <h2>Что мы знаем о компании</h2>
            </div>
          </div>
          <div className="ie-stats" style={{ marginTop: 0 }}>
            <div className="ie-stat" style={{ minWidth: 260 }}>
              <b style={{ fontSize: 22 }}>{row?.legalName || "не заполнено"}</b>
              <small>юридическое лицо</small>
            </div>
            <div className="ie-stat" style={{ minWidth: 200 }}>
              <b style={{ fontSize: 22 }}>{row?.registrationNo || "не заполнено"}</b>
              <small>регистрационный номер</small>
            </div>
          </div>
          <p style={{ marginTop: 18, color: "rgba(255,255,255,.65)", maxWidth: 680, fontSize: 14, lineHeight: 1.6 }}>
            Юридические данные заполняются по документам застройщика и проверяются реестром. Пока поле
            пустое, данные не подтверждены: запрашивайте регистрационные документы у застройщика напрямую.
          </p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
