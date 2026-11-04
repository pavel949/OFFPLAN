export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { Scene } from "@/components/ie/Scene";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { fmtM, fmtPct, TYPE_RU } from "@/lib/analytics";
import { getProjects } from "@/lib/catalog";
import { getRegionMeta, locationRows } from "@/lib/locations";

export const metadata: Metadata = {
  title: "Локации: районы Пхукета и проекты в них — Ignatev Estate",
  description: "Районы Пхукета: сколько проектов строится, какие типы и цены, доходность и застройщики. Откройте локацию, чтобы изучить район.",
  alternates: { canonical: "/locations" },
};

export default async function LocationsPage() {
  const [projects, regions] = await Promise.all([getProjects(), getRegionMeta()]);
  const rows = locationRows(projects, regions);
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
          {[...groups].map(([parent, list]) => (
            <div key={parent} style={{ marginBottom: 44 }}>
              <div className="ie-section-head">
                <div>
                  <div className="ie-eyebrow">{list.reduce((s, r) => s + r.projects, 0)} проектов</div>
                  <h2>{parent}</h2>
                </div>
              </div>
              <div className="ie-locs">
                {list.map((r) => {
                  const top = Object.entries(r.types).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "villa";
                  return (
                    <Link key={r.key} href={`/locations/${r.key}`} className="ie-loc">
                      <div className="ie-loc-media">
                        <Scene seed={r.key.length * 7 + r.projects} kind={top === "condo" ? "condo" : top === "house" ? "house" : "villa"} />
                        <span className="ie-loc-count">{r.projects} проект.</span>
                        <div className="ie-loc-name">
                          <small>{r.meta.parentNameRu ?? "Локация"}</small>
                          <b>{r.meta.nameRu}</b>
                        </div>
                      </div>
                      <div className="ie-loc-body">
                        <div className="ie-loc-stats">
                          <div><b>{fmtM(r.median)}</b><small>медиана цены</small></div>
                          <div><b>{fmtPct(r.yieldAvg)}</b><small>доходность</small></div>
                          <div><b>{r.developers}</b><small>застройщиков</small></div>
                        </div>
                        <div className="ie-loc-types">
                          {Object.entries(r.types).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                            <span key={t} className="ie-fact">{TYPE_RU[t] ?? t}: {n}</span>
                          ))}
                          {r.ready ? <span className="ie-fact">сдано: {r.ready}</span> : null}
                        </div>
                        <span className="ie-loc-go">Изучить локацию →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
