import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        // Next.js 15+: mutating request.cookies in middleware throws → 500.
        // Session refresh must go only on the response (Supabase SSR pattern).
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        if (responseHeaders) {
          for (const [k, v] of Object.entries(responseHeaders)) {
            supabaseResponse.headers.set(k, v);
          }
        }
      },
    },
  });

  // Avoid hanging the whole page if Supabase Auth is unreachable (VPN, paused project, DNS).
  await Promise.race([
    supabase.auth.getUser(),
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);
  return supabaseResponse;
}
