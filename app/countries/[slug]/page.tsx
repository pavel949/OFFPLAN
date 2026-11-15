export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTile } from "@/components/ie/ProjectTile";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { fmtM, summarize } from "@/lib/analytics";
import { getProjects } from "@/lib/catalog";
import { COUNTRY_ROLLOUT, LEGAL_LIFECYCLE, STATUS_LABEL } from "@/lib/country-content";
import { countryOfLocation, effectiveStatus, getCountryTrees, getLegalTopics, legalTopicSummary } from "@/lib/countries";
import { getHomeFeed } from "@/lib/home-feed";
import { getRegionMeta } from "@/lib/locations";
import { locationSlug } from "@/lib/slug";

type Params = { params: Promise<{ slug: string }> };
const STATUS = { active: "Работает", launching: "Готовим запуск", planned: "В планах" } as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const c = (await getCountryTrees()).find((x) => x.slug === slug);
  if (!c) return { title: "Страна — Ignatev Estate" };
  return {
    title: `${c.ru}: локации, правила покупки и юридическая информация — Ignatev Estate`,
    description: c.blurb,
    alternates: { canonical: `/countries/${c.slug}` },
  };
}

export default async function CountryPage({ params }: Params) {
  const slug = (await params).slug;
  const trees = await getCountryTrees();
  const c = trees.find((x) => x.slug === slug);
  if (!c) notFound();
  const [projects, topics, feed, regionMeta] = await Promise.all([getProjects(), getLegalTopics(c.code), getHomeFeed(), getRegionMeta()]);
  const mine = projects.filter((p) => (countryOfLocation(locationSlug(p.zone), trees)?.code ?? "TH") === c.code);
  const perLoc = new Map<string, typeof mine>();
  for (const p of mine) (perLoc.get(locationSlug(p.zone)) ?? perLoc.set(locationSlug(p.zone), []).get(locationSlug(p.zone))!).push(p);
  const s = summarize(mine);
  const verified = topics.filter((t) => effectiveStatus(t) === "verified").length;
  const jur = Object.values(regionMeta).find((m) => m.jurisdiction === c.code);
  void jur;

  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / <Link href="/countries">Страны</Link> / {c.ru}</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>{c.flag} {c.local}</div>
          <h1>{c.ru}</h1>
          <p>{c.blurb}</p>
          <div className="ie-stats">
            <div className="ie-stat"><b style={{ fontSize: 22 }}>{STATUS[c.status]}</b><small>статус страны</small></div>
            <div className="ie-stat"><b>{c.regions.length}</b><small>городов и регионов</small></div>
            <div className="ie-stat"><b>{c.regions.reduce((n, r) => n + r.locations.length, 0)}</b><small>локаций</small></div>
            <div className="ie-stat"><b>{mine.length}</b><small>проектов</small></div>
            <div className="ie-stat"><b>{verified}/{topics.length}</b><small>тем проверено юристом</small></div>
          </div>
          <nav className="ie-tabs" aria-label="Разделы страны">
            <a href="#locations">Города и локации</a>
            <a href="#law">Правила и право</a>
            <a href="#projects">Проекты</a>
            {c.status !== "active" ? <a href="#rollout">Запуск страны</a> : null}
          </nav>
        </div>
      </section>

      <section className="ie-section" id="locations">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div><div className="ie-eyebrow">Таксономия</div><h2>Города и локации</h2></div>
            <p>Страна → город или регион → район. Любой проект привязывается к локации и попадает в её страницу, аналитику и поиск.</p>
          </div>
          {c.regions.length ? (
            <div className="ie-regions">
              {c.regions.map((r) => {
                const n = r.locations.reduce((a, l) => a + (perLoc.get(l.slug)?.length ?? 0), 0);
                return (
                  <div key={r.slug} className="ie-region">
                    <div className="ie-region-head">
                      <h3>{r.ru}</h3>
                      <span>{n ? `${n} проект.` : "проектов пока нет"}</span>
                    </div>
                    <div className="ie-loc-types">
                      {r.locations.map((l) => {
                        const k = perLoc.get(l.slug)?.length ?? 0;
                        return (
                          <Link key={l.slug} href={`/locations/${l.slug}`} className={`ie-fact${k ? "" : " ie-fact--soon"}`} style={{ textDecoration: "none" }}>
                            {l.ru}{k ? ` · ${k}` : ""}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="ie-small">Города и локации будут добавлены при запуске страны.</p>
          )}
        </div>
      </section>

      <section className="ie-section ie-section--dark" id="law">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div><div className="ie-eyebrow">Правила и юридическая информация</div><h2>Как это устроено в стране</h2></div>
            <p>У каждой темы виден статус проверки. «Проверено юристом» означает: назван юрист, указана дата и срок действия. Всё остальное это пока рабочие материалы.</p>
          </div>
          <ol className="ie-lifecycle" aria-label="Жизненный цикл юридической информации">
            {LEGAL_LIFECYCLE.map((x, i) => (<li key={x.s}><b>{i + 1}</b><span>{x.t}</span></li>))}
          </ol>
          <div className="ie-pains" style={{ marginTop: 22 }}>
            {topics.map((t, i) => {
              const st = effectiveStatus(t);
              const lab = STATUS_LABEL[st];
              return (
                <details key={t.topic} className="ie-pain ie-pain--legal" open={i === 0}>
                  <summary>
                    <h3>{t.title}</h3>
                    <span className={`ie-lstatus ie-lstatus--${lab.tone}`}>{lab.ru}</span>
                  </summary>
                  <div className="ie-pain-body">
                    <p>{legalTopicSummary(t)}</p>
                    {t.points.length ? <ul className="ie-bul">{t.points.map((x) => <li key={x}>{x}</li>)}</ul> : null}
                    <dl className="ie-legal-meta">
                      <div><dt>Проверил</dt><dd>{t.reviewedBy ?? "пока не назначен"}</dd></div>
                      <div><dt>Дата проверки</dt><dd>{t.reviewedAt ? new Date(t.reviewedAt).toLocaleDateString("ru-RU") : "—"}</dd></div>
                      <div><dt>Действует до</dt><dd>{t.validUntil ? new Date(t.validUntil).toLocaleDateString("ru-RU") : "—"}</dd></div>
                      <div><dt>Источники</dt><dd>{t.sources.length ? t.sources.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer nofollow">{x.title}</a>) : "—"}</dd></div>
                    </dl>
                  </div>
                </details>
              );
            })}
          </div>
          <p className="ie-small" style={{ color: "rgba(255,255,255,.6)" }}>
            Справочная информация, не юридическая консультация. Перед сделкой проверьте договор у независимого юриста страны.
          </p>
        </div>
      </section>

      <section className="ie-section" id="projects">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div><div className="ie-eyebrow">Проекты</div><h2>Новостройки в стране</h2></div>
            {mine.length ? <p>Медиана цены {fmtM(s.price.median)}, {s.developers} застройщиков.</p> : null}
          </div>
          {mine.length ? (
            <>
              <div className="ie-grid">{mine.slice(0, 6).map((p) => <ProjectTile key={p.id} p={p} feed={feed} />)}</div>
              <p style={{ marginTop: 22 }}><Link href="/analytics" className="ie-btn ie-btn--ink">Вся аналитика →</Link></p>
            </>
          ) : (
            <div className="ie-empty">
              <h3>Проектов в стране пока нет</h3>
              <p>Застройщик может добавить проект в любую локацию страны: он сразу попадёт на страницу локации, в каталог и аналитику.</p>
              <Link href="/partner" className="ie-btn ie-btn--ink">Кабинет застройщика</Link>
            </div>
          )}
        </div>
      </section>

      {c.status !== "active" ? (
        <section className="ie-section" id="rollout" style={{ paddingTop: 0 }}>
          <div className="ie-wrap">
            <div className="ie-section-head"><div><div className="ie-eyebrow">Как открывается страна</div><h2>Запуск {c.ru}</h2></div></div>
            <ol className="ie-steps2">
              {COUNTRY_ROLLOUT.map((x, i) => (
                <li key={x.t}><b>{x.t} {i < (c.status === "launching" ? 1 : 0) ? "· готово" : ""}</b><span>{x.d}</span></li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
      <SiteFooter />
    </div>
  );
}
