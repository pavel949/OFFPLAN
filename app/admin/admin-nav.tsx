"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdmin } from "@/app/actions/admin-auth";
import { ADMIN_GROUPS, adminRouteActive } from "@/lib/admin-workspace";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Управление платформой">
      <div className="admin-nav-title">Управление платформой</div>
      {ADMIN_GROUPS.map(group => (
        <section className="admin-nav-group" key={group.label} aria-label={group.label}>
          <h2 className="admin-nav-group-title">{group.label}</h2>
          {group.items.map(({ href, label }) => {
            const on = adminRouteActive(pathname, href);
            return <Link key={href} href={href} aria-current={on ? "page" : undefined} className={`admin-nav-link${on ? " on" : ""}`}>{label}</Link>;
          })}
        </section>
      ))}
      <div className="admin-nav-foot">
        <form action={logoutAdmin}><button type="submit" className="admin-nav-out">Выйти</button></form>
      </div>
    </nav>
  );
}
