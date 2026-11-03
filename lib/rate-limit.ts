/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * NOTE: state is per server instance. On serverless this only slows down naive
 * abuse; the authoritative limit must live at the edge (Vercel Firewall / WAF
 * rate-limit rules) or in Redis. Used as a defence-in-depth layer.
 */
type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; retryAfterMs: number } {
  let b = buckets.get(key);
  if (!b) {
    if (buckets.size >= MAX_KEYS) {
      // Drop oldest entries to bound memory.
      const first = buckets.keys().next().value;
      if (first !== undefined) buckets.delete(first);
    }
    b = { hits: [] };
    buckets.set(key, b);
  }
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    return { ok: false, retryAfterMs: windowMs - (now - b.hits[0]) };
  }
  b.hits.push(now);
  return { ok: true, retryAfterMs: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const xf = headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
