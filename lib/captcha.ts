/** Cloudflare Turnstile verification. Disabled (always ok) when TURNSTILE_SECRET_KEY is unset. */
export function captchaEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyCaptcha(
  token: string | null | undefined,
  ip?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // A partial configuration is a deployment error, not permission to bypass CAPTCHA.
  if (!secret) return !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const j = (await res.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    // Fail closed: if the captcha provider is unreachable we do not accept the lead silently.
    return false;
  }
}
