export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { getAdminSessionOk } from "@/lib/admin-server-auth";
import { AdminChrome } from "./admin-chrome";
import { AdminLogin } from "./admin-login";
import "./admin.css";

export const metadata: Metadata = {
  title: "Админ — Ignatev Estate",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await getAdminSessionOk();
  if (!ok) {
    return <AdminLogin />;
  }
  return <AdminChrome>{children}</AdminChrome>;
}
