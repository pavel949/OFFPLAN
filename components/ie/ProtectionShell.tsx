import Link from "next/link";
import { PROTECTION_NAV } from "@/lib/protection-content";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function ProtectionShell({
  active,
  eyebrow,
  title,
  lead,
  children,
}: {
  active: string;
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ie-page">
      <SiteHeader />
      <section className="ie-sub">
        <div className="ie-wrap">
          <div className="ie-crumbs">
            <Link href="/">Каталог</Link> / <Link href="/protection">Защита прав</Link>
          </div>
          <div className="ie-eyebrow" style={{ marginTop: 18 }}>{eyebrow}</div>
          <h1>{title}</h1>
          <p>{lead}</p>
          <nav className="ie-tabs" aria-label="Разделы защиты прав">
            {PROTECTION_NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={n.href === active ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      {children}
      <SiteFooter />
    </div>
  );
}
