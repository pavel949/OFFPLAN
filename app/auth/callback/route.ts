import { NextResponse, type NextRequest } from "next/server";
import { isAuthDestination } from "@/lib/supabase/auth-destinations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const destination = request.nextUrl.searchParams.get("next");
  const code = request.nextUrl.searchParams.get("code");
  const validDestination = isAuthDestination(destination);
  const failure = new URL("/auth/error", request.url);
  if (validDestination) failure.searchParams.set("next", destination);

  let target = failure;
  if (validDestination && code) {
    try {
      const db = await createSupabaseServerClient();
      const result = await db?.auth.exchangeCodeForSession(code);
      if (result?.data.session && !result.error) target = new URL(destination, request.url);
    } catch {
      // Network errors and invalid links use the same retry screen.
    }
  }

  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: target.pathname + target.search,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
