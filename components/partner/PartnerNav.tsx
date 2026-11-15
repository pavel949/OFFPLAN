"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/partner", "Обзор", true],
  ["/partner/projects", "Мои проекты", false],
  ["/partner/leads", "Заявки", false],
  ["/partner/analytics", "Результаты", false],
  ["/partner/deals", "Сделки", false],
  ["/partner/corrections", "Правки", false],
] as const;

export function PartnerNav() {
  const path = usePathname();
  return (
    <nav className="pt-nav" aria-label="Разделы кабинета">
      {ITEMS.map(([href, label, exact]) => (
        <Link key={href} href={href} className={(exact ? path === href : path.startsWith(href)) ? "on" : ""}>{label}</Link>
      ))}
      <Link href="/" target="_blank">Каталог ↗</Link>
    </nav>
  );
}
