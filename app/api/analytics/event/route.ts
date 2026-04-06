import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/marketplace/analytics";

export async function POST(req: Request) {
  const secret = process.env.ANALYTICS_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 501 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let body: { name?: string; project_id?: string; path?: string; payload?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ ok: false }, { status: 400 });
  await recordAnalyticsEvent({
    name: body.name,
    project_id: body.project_id ?? null,
    path: body.path ?? null,
    payload: body.payload ?? {},
  });
  return NextResponse.json({ ok: true });
}
