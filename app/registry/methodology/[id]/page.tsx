import "../../../admin/admin.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MethodologyStudio } from "@/components/clearview/MethodologyStudio";
import { ReviewActions } from "@/components/clearview/ReviewActions";
import { ATLAS_V21, isCvConfig } from "@/lib/clearview/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReviewMethodologyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createSupabaseServerClient();
  if (!db) return <p style={{ padding: 24 }}>Раздел временно недоступен.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/registry/login");
  const { data: prof } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "reviewer") return <p style={{ padding: 24 }}>Раздел только для независимых аналитиков реестра.</p>;

  const [{ data: row }, { data: cfg }, { data: pub }, { data: st }] = await Promise.all([
    db.from("cv_methodology_versions").select("id, version, status, change_summary").eq("id", id).maybeSingle(),
    db.rpc("cv_version_config", { p_id: id }),
    db.from("cv_methodology_versions").select("id, version").eq("status", "published").maybeSingle(),
    db.rpc("cv_approval_status", { p_id: id }),
  ]);
  if (!row || !isCvConfig(cfg)) notFound();
  const { data: baseRaw } = pub ? await db.rpc("cv_version_config", { p_id: pub.id }) : { data: null };
  const baseline = isCvConfig(baseRaw) ? baseRaw : ATLAS_V21;
  const status = (Array.isArray(st) ? st[0] : st) as { approvals: number; mine: string | null } | null;

  return (
    <main className="adm-wrap" style={{ margin: "0 auto", padding: "32px 16px", maxWidth: 1320 }}>
      <Link href="/registry/methodology" className="adm-back">← Утверждение методологии</Link>
      <div className="adm-head"><div><h1>ClearView {row.version}</h1><p className="adm-sub"><span className="adm-pill warn">{row.status === "review" ? "на утверждении" : row.status}</span><span>{row.change_summary}</span></p></div></div>
      <MethodologyStudio id={id} initial={cfg} baseline={baseline} baselineLabel={pub ? `Действующая версия ${pub.version}` : "Atlas v2.1 как опубликован"} status={row.status} mode="review">
        {row.status === "review" ? <ReviewActions id={id} approvals={status?.approvals ?? 0} mine={status?.mine ?? null} /> : <section className="adm-card" style={{ margin: 0 }}><h3>Статус: {row.status}</h3></section>}
      </MethodologyStudio>
    </main>
  );
}
