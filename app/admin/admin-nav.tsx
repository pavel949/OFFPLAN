"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdmin } from "@/app/actions/admin-auth";

const items = [
  { href:"/admin/evidence", label:"Проверка сведений" },
  { href: "/admin", label: "Обзор" },
  { href: "/admin/projects", label: "Проекты" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/leads", label: "Лиды" },
  { href: "/admin/moderation", label: "Модерация" },
  { href: "/admin/corrections", label: "Правки" },
  { href: "/admin/deals", label: "Сделки" },
  { href: "/admin/commissions", label: "Комиссии" },
  { href: "/admin/ingest/whatsapp", label: "WhatsApp" },
  { href: "/admin/catalog", label: "Каталог JSON" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      <div className="admin-nav-title">Панель</div>
      {items.map(({ href, label }) => {
        const on =
          href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`admin-nav-link${on ? " on" : ""}`}
          >
            {label}
          </Link>
        );
      })}
      <div className="admin-nav-foot">
        <form action={logoutAdmin}>
          <button type="submit" className="admin-nav-out">
            Выйти
          </button>
        </form>
      </div>
    </nav>
  );
}
