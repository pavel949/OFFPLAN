"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PROTECTION_NAV } from "@/lib/protection-content";

type Item = { href: string; label: string; children?: readonly { href: string; label: string }[] };

const NAV: Item[] = [
  { href: "/", label: "Каталог" },
  { href: "/locations", label: "Локации" },
  { href: "/developers", label: "Застройщики" },
  { href: "/analytics", label: "Аналитика" },
  { href: "/market?tab=calc", label: "Калькулятор" },
  { href: "/guide", label: "Знания" },
  { href: "/protection", label: "Защита прав", children: PROTECTION_NAV },
  { href: "/registry", label: "Реестр проверки" },
];

/** Floats transparent over dark heroes and turns into frosted glass after a few pixels of scroll. */
export function SiteHeader() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  const current = (href: string) => href.split("?")[0] === path;

  return (
    <header className={`ie-hdr${solid || open ? " is-solid" : ""}`}>
      <div className="ie-hdr-in">
        <Link href="/" className="ie-brand" aria-label="Ignatev Estate: на главную">
          <span className="ie-brand-mark">IE</span>
          <span className="ie-brand-name">
            Ignatev Estate
            <small>Проверенные новостройки ЮВА</small>
          </span>
        </Link>
        <nav className={`ie-nav${open ? " is-open" : ""}`} aria-label="Основная навигация">
          {NAV.map((n) =>
            n.children ? (
              <div key={n.href} className="ie-nav-group">
                <Link href={n.href} aria-haspopup="true" aria-current={path.startsWith("/protection") ? "page" : undefined}>
                  {n.label} <span aria-hidden="true" className="ie-caret">▾</span>
                </Link>
                <div className="ie-nav-sub" role="menu">
                  {n.children.map((c) => (
                    <Link key={c.href} href={c.href} role="menuitem" aria-current={current(c.href) ? "page" : undefined}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ie-hdr-act">
          <Link href="/login" className="ie-btn ie-btn--ghost">
            Войти
          </Link>
          <button
            type="button"
            className="ie-burger"
            aria-label="Меню"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
    </header>
  );
}
