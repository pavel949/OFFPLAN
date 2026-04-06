import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "ie_admin";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function signAdminToken(secret: string): string {
  const exp = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp }), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string, secret: string): boolean {
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (sig.length !== expected.length) return false;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  try {
    const p = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };
    if (typeof p.exp !== "number" || p.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}
