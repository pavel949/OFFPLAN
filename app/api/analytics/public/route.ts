import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/marketplace/analytics";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 4096;

const ALLOWED = new Set([
  "project.view",
  "catalog.filter",
  "project.cta_click",
]);

/**
 * Same-origin product analytics (no shared secret in the browser).
 * Abuse mitigation: only whitelisted event names; optional project_id UUID.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  }

  if (!rateLimit(`analytics:${clientIp(req.headers)}`, 120, 60_000).ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: {
    name?: string;
    project_id?: string | null;
    path?: string | null;
    payload?: Record<string, unknown>;
  };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    body = JSON.parse(text) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.name || !ALLOWED.has(body.name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pid = body.project_id;
  if (pid != null && pid !== "") {
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(pid)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
  }

  await recordAnalyticsEvent({
    name: body.name,
    project_id: pid ?? null,
    path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
  });
  return NextResponse.json({ ok: true });
}
