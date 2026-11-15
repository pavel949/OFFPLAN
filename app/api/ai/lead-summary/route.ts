import { NextResponse } from "next/server";
import { getAdminSessionOk } from "@/lib/admin-server-auth";

/**
 * Internal AI stub: replace with Vercel AI SDK + provider when keys are configured.
 * POST body: { text: string } — e.g. lead message + notes
 */
export async function POST(req: Request) {
  if (!(await getAdminSessionOk())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body?.text === "string" ? body.text.slice(0, 8000) : "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const summary = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  return NextResponse.json({
    summary,
    suggestedNextStep:
      "Follow up by phone; confirm budget and timeline; book viewing.",
    model: "stub",
  });
}
