import { createClient } from "@supabase/supabase-js";

/**
 * Stateless anon-key client for PUBLIC reads. Row Level Security is the authority here:
 * only published catalogue data is visible. Never use the service-role client for
 * anything that renders to anonymous visitors.
 */
export function hasSupabasePublicConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON key");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
