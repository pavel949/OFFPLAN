import { cookies } from "next/headers";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-session";

export async function getAdminSessionOk(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  const t = jar.get(COOKIE_NAME)?.value;
  if (!t) return false;
  return verifyAdminToken(t, secret);
}
