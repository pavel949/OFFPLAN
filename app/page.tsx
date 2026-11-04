export const dynamic = "force-dynamic";
import Link from "next/link";
import { Suspense } from "react";
import { HomeExperience } from "@/components/ie/HomeExperience";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { getCatalogMeta, getProjects } from "@/lib/catalog";
import { developerSlug, summarizeDevelopers } from "@/lib/developers";
import { getHomeFeed } from "@/lib/home-feed";
import { GUIDE } from "@/lib/guide-content";
import { effectiveLevel } from "@/lib/registry/levels";
import { projectSlug } from "@/lib/slug";

export default async function Home() {
  const [projects, feed] = await Promise.all([getProjects(), getHomeFeed()]);
  const meta = getCatalogMeta(projects);
  const devs = summarizeDevelopers(projects);
  const verified = projects.filter((p) => effectiveLevel(p.ver) > 0).length;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const news = feed.updates.slice(0, 6).filter((u) => byId.has(u.projectId));

  return (
    <div className="ie-page">
      <SiteHeader />
      <Suspense fallback={<div style={{ minHeight: "70vh", background: "#060f1e" }} />}>
        <HomeExperience
          projects={projects}
          feed={feed}
          stats={{
            projects: projects.length,
            developers: devs.length,
            verified,
            updatedLabel: meta.quarterLabel,
          }}
        />
      </Suspense>

      <section className="ie-section" style={{ paddingTop: 0 }}>
        <div className="ie-wrap">
          <div className="ie-banner">
            <div>
              <div className="ie-eyebrow">Защита прав российских инвесторов</div>
              <h2>Смотрите и выбирайте здесь. Если что-то пошло не так, обращайтесь к нам.</h2>
            </div>
            <p>
              Проверенные данные о проектах и застройщиках собраны в одном месте. Нужно уточнить детали, проверить договор или
              решить спор с застройщиком (просрочка, возврат денег, несоответствие объекта) — мы рядом, на Пхукете.
            </p>
            <div className="ie-pillars">
              <div><b>Смотрите здесь</b><span>Свежие цены, этапы стройки, фотоотчёты и наличие лотов.</span></div>
              <div><b>Выбирайте с проверкой</b><span>Уровни проверки реестра и досье каждого застройщика.</span></div>
              <div><b>Связывайтесь с нами</b><span>Вопросы до сделки и помощь при конфликтах и просрочках.</span></div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/protection" className="ie-btn ie-btn--gold">Как мы защищаем инвесторов</Link>
              <Link href="/protection/contact" className="ie-btn ie-btn--ghost">Обратиться за помощью</Link>
            </div>
          </div>
        </div>
      </section>

      {news.length ? (
        <section className="ie-section ie-section--dark">
          <div className="ie-wrap">
            <div className="ie-section-head">
              <div>
                <div className="ie-eyebrow">Со строительных площадок</div>
                <h2>Свежие новости проектов</h2>
              </div>
              <p>Фотоотчёты, этапы и анонсы публикуют сами застройщики.</p>
            </div>
            <div className="ie-news">
              {news.map((u) => {
                const p = byId.get(u.projectId)!;
                return (
                  <Link key={u.id} href={`/project/${projectSlug(p)}`} className="ie-news-item">
                    <time dateTime={u.at}>{new Date(u.at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · {p.n}</time>
                    <h3>{u.titleRu}</h3>
                    {u.bodyRu ? <p>{u.bodyRu.slice(0, 140)}</p> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="ie-section ie-section--dark" style={{ paddingTop: news.length ? 0 : undefined }}>
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Досье застройщиков</div>
              <h2>Кто строит</h2>
            </div>
            <p>
              У каждого застройщика собраны проекты, сданные объекты, юридические данные и статус
              проверки: решение начинается с того, кому вы доверяете деньги.
            </p>
            <Link href="/developers" className="ie-btn ie-btn--ghost">
              Все застройщики →
            </Link>
          </div>
          <div className="ie-devs">
            {devs.slice(0, 8).map((d) => (
              <Link key={d.slug} href={`/developers/${developerSlug(d.code)}`} className="ie-dev">
                <span className="ie-dev-mono">{d.name.charAt(0)}</span>
                <h3>{d.name}</h3>
                <p>{d.zones.slice(0, 3).join(" · ")}</p>
                <div className="ie-dev-meta">
                  <span>{d.projects.length} проект.</span>
                  {d.completed ? <span>{d.completed} сдано</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-section-head">
            <div>
              <div className="ie-eyebrow">Знания</div>
              <h2>Прежде чем покупать</h2>
            </div>
            <p>Страна, районы, сделка и безопасность: короткие материалы для тех, кто покупает впервые.</p>
            <Link href="/guide" className="ie-btn ie-btn--line">
              Все материалы →
            </Link>
          </div>
          <div className="ie-know">
            {GUIDE.slice(0, 3).map((a) => (
              <Link key={a.slug} href={`/guide/${a.slug}`}>
                <span className="k">{a.group}</span>
                <h3>{a.title}</h3>
                <p>{a.lead}</p>
                <span className="more">Читать →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
