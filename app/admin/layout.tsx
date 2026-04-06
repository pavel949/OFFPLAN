import { cookies } from "next/headers";
import type { Metadata } from "next";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-session";
import { AdminChrome } from "./admin-chrome";
import { AdminLogin } from "./admin-login";
import "./admin.css";

export const metadata: Metadata = {
  title: "Админ — Ignatev Estate",
  robots: { index: false, follow: false },
};

async function getAdminSession(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  const t = jar.get(COOKIE_NAME)?.value;
  if (!t) return false;
  return verifyAdminToken(t, secret);
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await getAdminSession();
  if (!ok) {
    return <AdminLogin />;
  }
  return <AdminChrome>{children}</AdminChrome>;
}
