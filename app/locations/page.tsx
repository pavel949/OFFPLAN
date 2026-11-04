export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { Scene } from "@/components/ie/Scene";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { fmtM, fmtPct, TYPE_RU } from "@/lib/analytics";
import { getProjects } from "@/lib/catalog";
import { getCountryTrees } from "@/lib/countries";
import { getRegionMeta, locationRows } from "@/lib/locations";

export const metadata: Metadata = {
  title: "Локации: районы Пхукета и проекты в них — Ignatev Estate",
  description: "Районы Пхукета: сколько проектов строится, какие типы и цены, доходность и застройщики. Откройте локацию, чтобы изучить район.",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const [projects, regions, trees] = await Promise.all([getProjects(), getRegionMeta(), getCountryTrees()]);
  const rows = locationRows(projects, regions);
  const rowBySlug = new Map(rows.map((r) => [r.key, r]));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.meta.parentNameRu ?? "Другие локации";
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Локации</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>Где строится</div>
          <h1>Локации</h1>
          <p>
            Район определяет цену, аренду и образ жизни. Откройте локацию: сколько проектов в ней строится, какие типы и цены, кто
            застройщики и что отличает район.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
            <Link href="/analytics" className="ie-btn ie-btn--gold">Аналитика по всем проектам</Link>
          </div>
        </div>
      </section>
      <section className="ie-section">
        <div className="ie-wrap">
          {trees.filter((c) => c.regions.length).map((c) => (
            <div key={c.code} style={{ marginBottom: 56 }}>
              <div className="ie-section-head">
                <div>
                  <div className="ie-eyebrow">{c.flag} {c.status === "active" ? "Работает" : "Готовим запуск"}</div>
                  <h2>{c.ru}</h2>
                </div>
                <Link href={`/countries/${c.slug}`} className="ie-btn ie-btn--line">Страна, правила и право →</Link>
              </div>
              {c.regions.map((reg) => {
                const withProjects = reg.locations.filter((l) => rowBySlug.has(l.slug));
                const empty = reg.locations.filter((l) => !rowBySlug.has(l.slug));
                const total = withProjects.reduce((n, l) => n + (rowBySlug.get(l.slug)?.projects ?? 0), 0);
                return (
                  <div key={reg.slug} style={{ marginBottom: 34 }}>
                    <div className="ie-region-head" style={{ marginBottom: 14 }}>
                      <h3 className="ie-serif" style={{ fontSize: 30, margin: 0 }}>{reg.ru}</h3>
                      <span>{total ? `${total} проектов` : "проектов пока нет"}</span>
                    </div>
                    {withProjects.length ? (
                      <div className="ie-locs">
                        {withProjects.map((l) => {
                          const r = rowBySlug.get(l.slug)!;
                          const top = Object.entries(r.types).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "villa";
                          return (
                            <Link key={r.key} href={`/locations/${r.key}`} className="ie-loc">
                              <div className="ie-loc-media">
                                <Scene seed={r.key.length * 7 + r.projects} kind={top === "condo" ? "condo" : top === "house" ? "house" : "villa"} />
                                <span className="ie-loc-count">{r.projects} проект.</span>
                                <div className="ie-loc-name"><small>{reg.ru}</small><b>{l.ru}</b></div>
                              </div>
                              <div className="ie-loc-body">
                                <div className="ie-loc-stats">
                                  <div><b>{fmtM(r.median)}</b><small>медиана цены</small></div>
                                  <div><b>{fmtPct(r.yieldAvg)}</b><small>доходность</small></div>
                                  <div><b>{r.developers}</b><small>застройщиков</small></div>
                                </div>
                                <div className="ie-loc-types">
                                  {Object.entries(r.types).sort((a, b) => b[1] - a[1]).map(([t, n]) => (<span key={t} className="ie-fact">{TYPE_RU[t] ?? t}: {n}</span>))}
                                  {r.ready ? <span className="ie-fact">сдано: {r.ready}</span> : null}
                                </div>
                                <span className="ie-loc-go">Изучить локацию →</span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    ) : null}
                    {empty.length ? (
                      <div className="ie-loc-types" style={{ marginTop: withProjects.length ? 16 : 0 }}>
                        {empty.map((l) => (
                          <Link key={l.slug} href={`/locations/${l.slug}`} className="ie-fact ie-fact--soon" style={{ textDecoration: "none" }}>{l.ru} · скоро</Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
