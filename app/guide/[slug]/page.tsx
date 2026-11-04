import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/ie/SiteFooter";
import { SiteHeader } from "@/components/ie/SiteHeader";
import { GUIDE, guideBySlug } from "@/lib/guide-content";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDE.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const a = guideBySlug((await params).slug);
  if (!a) return { title: "Знания — Ignatev Estate" };
  return { title: `${a.title} — Ignatev Estate`, description: a.lead, alternates: { canonical: `/guide/${a.slug}` } };
}

export default async function GuideArticlePage({ params }: Params) {
  const a = guideBySlug((await params).slug);
  if (!a) notFound();
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs"><Link href="/">Каталог</Link> / <Link href="/guide">Знания</Link> / {a.group}</div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>{a.group}</div>
          <h1>{a.title}</h1>
          <p>{a.lead}</p>
        </div>
      </section>
      <section className="ie-section">
        <div className="ie-wrap">
          <article className="ie-prose">
            {a.blocks.map((b, i) =>
              b.t === "h2" ? <h2 key={i}>{b.text}</h2>
              : b.t === "h3" ? <h3 key={i}>{b.text}</h3>
              : b.t === "ul" ? <ul key={i}>{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>
              : b.t === "note" ? <div key={i} className="ie-note">{b.text}</div>
              : <p key={i}>{b.text}</p>,
            )}
            <p style={{ fontSize: 13, color: "#667" }}>Материал проверен редакцией: {a.reviewed}. Справочная информация, не юридическая консультация.</p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
