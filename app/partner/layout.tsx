import Link from "next/link";
import "../admin/admin.css";
import { PartnerNav } from "@/components/partner/PartnerNav";
import { SignOutButton } from "@/components/partner/SignOutButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "@/lib/supabase/service";

export const metadata = { title: "Кабинет застройщика — Ignatev Estate", robots: { index: false, follow: false } };

/** Header with navigation for signed-in developers; the login page renders on its own. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const db = await createSupabaseServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return <div className="pt-root">{children}</div>;

  const { data: prof } = await db.from("profiles").select("org_id, full_name").eq("id", user.id).maybeSingle();
  let orgName = "";
  if (prof?.org_id && hasSupabaseServiceConfig()) {
    const { data } = await createServiceRoleClient().from("orgs").select("name_ru, name_en").eq("id", prof.org_id).maybeSingle();
    orgName = (data?.name_ru || data?.name_en || "") as string;
  }
  return (
    <div className="pt-root">
      <header className="pt-bar">
        <div className="pt-bar-in">
          <Link href="/partner" className="pt-brand"><b>IE</b><span>Кабинет застройщика<small>Ignatev Estate</small></span></Link>
          <PartnerNav />
          <div className="pt-user"><span>{orgName || prof?.full_name || user.email}</span><SignOutButton /></div>
        </div>
      </header>
      <main className="pt-main">{children}</main>
    </div>
  );
}
