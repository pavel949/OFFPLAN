export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bars } from "@/components/ie/Bars";
import { ProjectTile } from "@/components/ie/ProjectTile";
import { Scene } from "@/components/ie/Scene";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { fmtInt, fmtM, fmtPct, groupBy, summarize, TYPE_RU } from "@/lib/analytics";
import { getProjects } from "@/lib/catalog";
import { developerSlug } from "@/lib/developers";
import { getHomeFeed } from "@/lib/home-feed";
import { LOCATION_PROFILES } from "@/lib/location-content";
import { getRegionMeta, locationRows, locationSlug, metaFor } from "@/lib/locations";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const [projects, regions] = await Promise.all([getProjects(), getRegionMeta()]);
  const inLoc = projects.filter((p) => locationSlug(p.zone) === slug);
  if (!inLoc.length) return null;
  return { projects, regions, inLoc, meta: metaFor(inLoc[0].zone, regions) };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return { title: "Локация — Ignatev Estate" };
  const s = summarize(d.inLoc);
  return {
    title: `${d.meta.nameRu}: проекты, цены и особенности района — Ignatev Estate`,
    description: `${d.meta.nameRu}: ${s.projects} проект., медиана цены ${fmtM(s.price.median)}, ${s.developers} застройщиков.`,
    alternates: { canonical: `/locations/${d.meta.slug}` },
  };
}

export default async function LocationPage({ params }: Params) {
  const slug = (await params).slug;
  const d = await load(slug);
  if (!d) notFound();
  const feed = await getHomeFeed();
  const s = summarize(d.inLoc);
  const profile = LOCATION_PROFILES[slug];
  const devs = groupBy(d.inLoc, (p) => developerSlug(p.dt), (p) => p.dev);
  const siblings = locationRows(d.projects, d.regions).filter((r) => r.key !== slug && r.meta.parentSlug === d.meta.parentSlug).slice(0, 8);
  const topType = Object.entries(s.byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "villa";
  const onSale = d.inLoc.reduce((n, p) => n + (feed.availability[p.id]?.available ?? 0), 0);
  const hasSale = d.inLoc.some((p) => feed.availability[p.id]?.available != null);

  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-phero" style={{ minHeight: 440 }}>
        <div className="ie-phero-bg"><Scene seed={slug.length * 7 + s.projects} kind={topType === "condo" ? "condo" : topType === "house" ? "house" : "villa"} /></div>
        <div className="ie-phero-shade" />
        <div className="ie-wrap ie-phero-in">
          <div className="ie-crumbs">
            <Link href="/">Каталог</Link> / <Link href="/locations">Локации</Link> / {d.meta.parentNameRu ?? ""}
          </div>
          <div className="ie-eyebrow" style={{ marginTop: 14 }}>{d.meta.parentNameRu ?? "Локация"}</div>
          <h1 className="ie-ptitle">{d.meta.nameRu}</h1>
          <p className="ie-psub">{s.projects} проект. · {s.developers} застройщиков · медиана цены {fmtM(s.price.median)}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <Link className="ie-btn ie-btn--gold" href={`/?zone=${encodeURIComponent(d.inLoc[0].zone)}#ie-results`}>Смотреть все проекты</Link>
            <Link className="ie-btn ie-btn--ghost" href={`/analytics?loc=${slug}`}>Аналитика локации</Link>
          </div>
        </div>
      </section>

      <div className="ie-wrap" style={{ padding: "36px 0 70px", display: "grid", gap: 20 }}>
        <div className="ie-kpis">
          <div className="ie-kpi"><small>Проектов</small><b>{s.projects}</b><span>{s.stage.ready} сдано · {s.stage.building} строится · {s.stage.offplan} старт</span></div>
          <div className="ie-kpi"><small>Цена от — до</small><b>{fmtM(s.price.min)}–{fmtM(s.price.max)}</b><span>медиана {fmtM(s.price.median)} (по {s.price.n} проект.)</span></div>
          <div className="ie-kpi"><small>Доходность (заявл.)</small><b>{fmtPct(s.yield.avg)}</b><span>среднее по {s.yield.n} проект.</span></div>
          <div className="ie-kpi"><small>Лотов в проектах</small><b>{fmtInt(s.units.total)}</b><span>данные по {s.units.coveredProjects} из {s.projects} проект.</span></div>
          <div className="ie-kpi"><small>Застройщиков</small><b>{s.developers}</b><span>{hasSale ? `${onSale} лотов в продаже` : "наличие лотов не внесено"}</span></div>
          <div className="ie-kpi"><small>Цена за м²</small><b>{s.perSqm.median ? `฿${fmtInt(s.perSqm.median)}` : "—"}</b><span>{s.perSqm.n ? `медиана по ${s.perSqm.n} проект.` : "в проектах не указана"}</span></div>
        </div>

        <section className="ie-card">
          <h2 className="ie-h2">О локации</h2>
          {profile ? (
            <>
              <p className="ie-lead">{profile.summary}</p>
              <div className="ie-two">
                <div>
                  <h3 className="ie-h3">Особенности</h3>
                  <ul className="ie-bul">{profile.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
                <div>
                  <h3 className="ie-h3">Кому подходит</h3>
                  <ul className="ie-bul">{profile.bestFor.map((h) => <li key={h}>{h}</li>)}</ul>
                </div>
              </div>
              <p className="ie-small">Обзорное описание. Расстояния, планы застройки и состояние инфраструктуры проверяйте на месте.</p>
            </>
          ) : (
            <p className="ie-small">Описание локации готовится. Цифры ниже рассчитаны по проектам каталога.</p>
          )}
        </section>

        <div className="ie-two">
          <section className="ie-card">
            <h2 className="ie-h2">Типы проектов</h2>
            <Bars
              items={Object.entries(s.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: TYPE_RU[k] ?? k, value: v }))}
            />
            <h3 className="ie-h3" style={{ marginTop: 20 }}>Распределение по цене</h3>
            <Bars items={s.buckets.map((b) => ({ key: b.key, label: b.label, value: b.projects }))} color="#1b6f80" />
          </section>
          <section className="ie-card">
            <h2 className="ie-h2">Сдача по годам</h2>
            <Bars items={s.byYear.map((y) => ({ key: String(y.year), label: String(y.year), value: y.projects, sub: `${y.units} лотов` }))} />
            <h3 className="ie-h3" style={{ marginTop: 20 }}>Кто строит</h3>
            <ul className="ie-links">
              {devs.slice(0, 8).map((x) => (
                <li key={x.key}>
                  <Link href={`/developers/${x.key}`}><b>{x.label}</b><span>{x.projects} проект. · медиана {fmtM(x.median)}</span></Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section>
          <div className="ie-section-head" style={{ marginBottom: 18 }}>
            <div><div className="ie-eyebrow">Проекты</div><h2>Что строится в {d.meta.nameRu}</h2></div>
          </div>
          <div className="ie-grid">
            {d.inLoc.map((p) => <ProjectTile key={p.id} p={p} feed={feed} />)}
          </div>
        </section>

        {siblings.length ? (
          <section className="ie-card">
            <h2 className="ie-h2">Соседние локации</h2>
            <div className="ie-loc-types">
              {siblings.map((r) => (
                <Link key={r.key} href={`/locations/${r.key}`} className="ie-fact" style={{ textDecoration: "none" }}>
                  {r.meta.nameRu} · {r.projects}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </div>
  );
}
