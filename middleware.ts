import { NextResponse, type NextRequest } from "next/server";
import { isAuthDestination } from "@/lib/supabase/auth-destinations";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  // Keep the existing allowed email redirect URLs and exchange the code before route guards run.
  if (request.method === "GET" && isAuthDestination(pathname) &&
      (searchParams.has("code") || searchParams.has("error_code") || searchParams.has("error"))) {
    const code = searchParams.get("code");
    const target = new URL("/auth/callback", request.url);
    target.searchParams.set("next", pathname);
    if (code) target.searchParams.set("code", code);
    return NextResponse.rewrite(target);
  }
  // The callback owns the session exchange and cookie write.
  if (pathname === "/auth/callback") return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
