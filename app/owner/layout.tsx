import type { Metadata } from "next";
import Link from "next/link";
import "../admin/admin.css";

export const metadata: Metadata = { title: "Владелец платформы — Ignatev Estate", robots: { index: false, follow: false } };

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root" style={{ display: "block" }}>
      <header style={{ padding: "14px 24px", borderBottom: "1px solid var(--adm-line, #e5e5e5)", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <b>Владелец платформы</b>
        <Link href="/owner/methodology">Методология ClearView</Link>
        <Link href="/admin">Админ-панель</Link>
        <Link href="/registry/methodology">Утверждение (аналитики)</Link>
      </header>
      <main className="admin-main" style={{ marginLeft: 0 }}>{children}</main>
    </div>
  );
}
