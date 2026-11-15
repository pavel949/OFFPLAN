import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The platform owner is a person (a Supabase Auth user), recognised by the database table `platform_owners`, never by a shared secret. */
export async function getOwner(): Promise<{ id: string } | null> {
  const db = await createSupabaseServerClient();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email_confirmed_at) return null;
  const { data } = await db.rpc("is_platform_owner");
  return data === true ? { id: user.id } : null;
}

export async function requireOwner(): Promise<{ id: string }> {
  const o = await getOwner();
  if (!o) redirect("/owner/login");
  return o;
}
