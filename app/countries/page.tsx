export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { getProjects } from "@/lib/catalog";
import { countryOfLocation, getCountryTrees } from "@/lib/countries";
import { locationSlug } from "@/lib/slug";

export const metadata: Metadata = {
  title: "Страны: Таиланд, Вьетнам и другие направления — Ignatev Estate",
  description: "Страны платформы: города и локации, правила покупки и проверенная юридическая информация по каждой стране.",
  alternates: { canonical: "/countries" },
};

const STATUS = { active: "Работает", launching: "Готовим запуск", planned: "В планах" } as const;

export default async function CountriesPage() {
  const [projects, trees] = await Promise.all([getProjects(), getCountryTrees()]);
  const count = (code: string) =>
    projects.filter((p) => (countryOfLocation(locationSlug(p.zone), trees)?.code ?? "TH") === code).length;
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Страны</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>География платформы</div>
          <h1>Страны</h1>
          <p>
            У каждой страны своя таксономия локаций, свои правила покупки и своя проверенная юридическая информация. Начинаем с
            Таиланда и последовательно открываем новые направления по одинаковому порядку.
          </p>
        </div>
      </section>
      <section className="ie-section">
        <div className="ie-wrap">
          <div className="ie-countries">
            {trees.map((c) => (
              <Link key={c.code} href={`/countries/${c.slug}`} className={`ie-country ie-country--${c.status}`}>
                <div className="ie-country-top">
                  <span className="ie-flag" aria-hidden="true">{c.flag}</span>
                  <span className={`ie-pill ie-pill--${c.status}`}>{STATUS[c.status]}</span>
                </div>
                <h2>{c.ru}</h2>
                <small>{c.local}</small>
                <p>{c.blurb}</p>
                <div className="ie-country-stats">
                  <div><b>{c.regions.length}</b><span>городов и регионов</span></div>
                  <div><b>{c.regions.reduce((n, r) => n + r.locations.length, 0)}</b><span>локаций</span></div>
                  <div><b>{count(c.code)}</b><span>проектов</span></div>
                </div>
                <span className="ie-country-go">Открыть страну →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
