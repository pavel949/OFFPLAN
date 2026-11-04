import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { GUIDE } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Знания: гид покупателя недвижимости Пхукета — Ignatev Estate",
  description: "Страна, районы, сделка и безопасность: как покупать новостройки на Пхукете и в Юго-Восточной Азии.",
};

export default function GuidePage() {
  const groups = ["Сделка", "Локация", "Безопасность", "Страна"] as const;
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / Знания</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>Гид покупателя</div>
          <h1>Знания</h1>
          <p>Страна, районы, сделка и безопасность: короткие материалы для тех, кто покупает на Пхукете и в Юго-Восточной Азии.</p>
        </div>
      </section>
      <section className="ie-section">
        <div className="ie-wrap">
          {groups.map((g) => {
            const items = GUIDE.filter((a) => a.group === g);
            if (!items.length) return null;
            return (
              <div key={g} style={{ marginBottom: 40 }}>
                <div className="ie-eyebrow" style={{ marginBottom: 14 }}>{g}</div>
                <div className="ie-know">
                  {items.map((a) => (
                    <Link key={a.slug} href={`/guide/${a.slug}`}>
                      <span className="k">{a.group}</span>
                      <h3>{a.title}</h3>
                      <p>{a.lead}</p>
                      <span className="more">Читать →</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
