export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { getProjects } from "@/lib/catalog";
import { summarizeDevelopers } from "@/lib/developers";
import { zoneLabel } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Застройщики Пхукета — досье и проекты — Ignatev Estate",
  description: "Досье застройщиков Пхукета: проекты, сданные объекты, юридические данные и статус проверки.",
};

export default async function DevelopersPage() {
  const devs = summarizeDevelopers(await getProjects());
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Застройщики</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>Досье</div>
          <h1>Застройщики</h1>
          <p>
            Кому вы доверяете деньги, важнее, чем как выглядит рендер. У каждого застройщика собраны его
            проекты, сданные объекты, юридические данные и статус проверки.
          </p>
        </div>
      </section>
      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-devs">
            {devs.map((d) => (
              <Link key={d.slug} href={`/developers/${d.slug}`} className="ie-dev">
                <span className="ie-dev-mono">{d.name.charAt(0)}</span>
                <h3>{d.name}</h3>
                <p>{d.zones.slice(0, 4).map((z) => zoneLabel(z, "ru")).join(" · ")}</p>
                <div className="ie-dev-meta">
                  <span>{d.projects.length} проект.</span>
                  {d.completed ? <span>{d.completed} сдано</span> : null}
                  {d.fromPriceM ? <span>от ฿{d.fromPriceM}M</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
