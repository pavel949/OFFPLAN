"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  signAdminToken,
} from "@/lib/admin-session";

export async function loginAdmin(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return { ok: false, error: "ADMIN_SECRET не задан в окружении" };
  }
  const password = String(formData.get("password") ?? "");
  if (password !== secret) {
    return { ok: false, error: "Неверный пароль" };
  }
  const token = signAdminToken(secret);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
  });
  redirect("/admin");
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/admin");
}
