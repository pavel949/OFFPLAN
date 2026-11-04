import type { LeadSalesSummary } from "@/lib/leads/sales-summary";
import { createHmac } from "crypto";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export type LeadWebhookPayload = {
  event: "lead.created";
  sales_selection?:LeadSalesSummary;
  lead_id: string;
  project_uuid: string | null;
  org_id: string | null;
  name: string;
  email: string;
  phone: string;
  created_at: string;
};

/**
 * Signature scheme (verify on the receiving side):
 *   X-OFFPLAN-Timestamp: unix seconds
 *   X-OFFPLAN-Signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
 * The secret itself is never sent over the wire.
 */
export function signWebhook(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Only public https endpoints (basic SSRF guard; private ranges are blocked by hostname). */
export function isSafeWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h)) return false;
    if (h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) return false;
    return true;
  } catch {
    return false;
  }
}

async function deliver(url: string, secret: string, body: string): Promise<boolean> {
  const delays = [0, 1000, 4000];
  for (const wait of delays) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const ts = String(Math.floor(Date.now() / 1000));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OFFPLAN-Timestamp": ts,
          "X-OFFPLAN-Signature": signWebhook(secret, ts, body),
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return true;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return false;
    } catch {
      /* retry */
    }
  }
  return false;
}

/** Call inside `after()` so delivery survives the response on serverless. */
export async function dispatchLeadWebhooks(payload: LeadWebhookPayload): Promise<void> {
  if (!hasSupabaseServiceConfig() || !payload.org_id) return;
  const supabase = createServiceRoleClient();
  const { data: endpoints } = await supabase
    .from("org_webhook_endpoints")
    .select("id, url, secret, events, is_active")
    .eq("org_id", payload.org_id)
    .eq("is_active", true);
  if (!endpoints?.length) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    endpoints.map(async (ep) => {
      const row = ep as { id: string; url: string; secret: string; events: string[] | null };
      if (row.events?.length && !row.events.includes(payload.event)) return;
      if (!isSafeWebhookUrl(row.url)) {
        console.error("[webhook] blocked unsafe URL for endpoint", row.id);
        return;
      }
      const ok = await deliver(row.url, row.secret, body);
      if (!ok) console.error("[webhook] delivery failed after retries", row.id, payload.lead_id);
    }),
  );
}
