import { createHash } from "node:crypto";
import { rateLimit } from "./rate-limit";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "./supabase/service";

export async function serverRateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterMs: number; unavailable?: boolean }> {
  if (!hasSupabaseServiceConfig() && process.env.NODE_ENV !== "production") return rateLimit(key, limit, windowMs);
  try {
    // Include the window/limit in the bucket identity; store no raw IPs or emails.
    const hash = createHash("sha256").update(`${limit}:${windowMs}:${key}`).digest("hex");
    const { data, error } = await createServiceRoleClient().rpc("consume_rate_limit", {
      p_key: hash, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000),
    }).abortSignal(AbortSignal.timeout(5000));
    if (error || !data || typeof data.ok !== "boolean" || typeof data.retry_after_ms !== "number") throw new Error("Rate limit unavailable");
    return { ok: data.ok, retryAfterMs: data.retry_after_ms };
  } catch {
    // Never fall back to a per-instance allowance during a production outage.
    console.error("[rate-limit] shared limiter unavailable");
    return { ok: false, retryAfterMs: windowMs, unavailable: true };
  }
}
