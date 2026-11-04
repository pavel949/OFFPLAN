"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  safeEqual,
  signAdminToken,
} from "@/lib/admin-session";
import { serverRateLimit } from "@/lib/server-rate-limit";
import { clientIp } from "@/lib/rate-limit";

export async function loginAdmin(
  _prev: { ok?: boolean; error?: string } | undefined,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return { ok: false, error: "ADMIN_SECRET не задан в окружении" };
  }
  if (process.env.NODE_ENV === "production" && secret.length < 16) {
    return { ok: false, error: "ADMIN_SECRET слишком короткий (минимум 16 символов)" };
  }
  // 5 attempts / 15 min per IP across all application instances.
  const ip = clientIp(await headers());
  const rl = await serverRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return {
      ok: false,
      error: rl.unavailable ? "Вход временно недоступен. Повторите позже." : `Слишком много попыток. Повторите через ${Math.ceil(rl.retryAfterMs / 60000)} мин.`,
    };
  }
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, secret)) {
    await new Promise((r) => setTimeout(r, 800));
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
