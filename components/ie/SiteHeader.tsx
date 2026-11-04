"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Каталог" },
  { href: "/developers", label: "Застройщики" },
  { href: "/market?tab=analytics", label: "Аналитика рынка" },
  { href: "/market?tab=calc", label: "Калькулятор" },
  { href: "/guide", label: "Знания" },
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
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.href.split("?")[0] === path ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
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
