/**
 * Transactional email via Resend REST API. No-op (returns false) when not configured.
 * Env: RESEND_API_KEY, NOTIFY_FROM (e.g. "OFFPLAN <leads@yourdomain>"), LEAD_NOTIFY_EMAIL.
 */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyNewLead(lead: {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  projectName: string | null;
}): Promise<void> {
  const to = process.env.LEAD_NOTIFY_EMAIL;
  if (!to) {
    console.error("[notify] lead email is not configured; review new leads in admin", lead.id);
    return;
  }
  const ok = await sendEmail({
    to: to.split(",").map((s) => s.trim()).filter(Boolean),
    subject: `New lead: ${lead.name}${lead.projectName ? ` — ${lead.projectName}` : ""}`,
    text: [
      `Lead ${lead.id}`,
      `Name: ${lead.name}`,
      `Email: ${lead.email}`,
      `Phone: ${lead.phone || "-"}`,
      `Project: ${lead.projectName ?? "-"}`,
      "",
      lead.message || "(no message)",
    ].join("\n"),
  });
  if (!ok) console.error("[notify] lead notification email was not sent", lead.id);
}
