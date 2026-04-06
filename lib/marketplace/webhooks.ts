import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export type LeadWebhookPayload = {
  event: "lead.created";
  lead_id: string;
  project_uuid: string | null;
  org_id: string | null;
  name: string;
  email: string;
  phone: string;
  created_at: string;
};

export async function dispatchLeadWebhooks(payload: LeadWebhookPayload): Promise<void> {
  if (!hasSupabaseServiceConfig()) return;
  const supabase = createServiceRoleClient();
  if (!payload.org_id) return;
  const { data: endpoints } = await supabase
    .from("org_webhook_endpoints")
    .select("id, url, secret, events, is_active")
    .eq("org_id", payload.org_id)
    .eq("is_active", true);
  if (!endpoints?.length) return;
  const body = JSON.stringify(payload);
  for (const ep of endpoints) {
    const row = ep as { url: string; secret: string; events: string[] | null };
    const evs = row.events;
    if (evs?.length && !evs.includes(payload.event)) continue;
    try {
      await fetch(row.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": row.secret,
        },
        body,
      });
    } catch {
      /* non-blocking */
    }
  }
}
