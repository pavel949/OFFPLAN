import Link from "next/link";
import { notFound } from "next/navigation";
import { cvGetVersion } from "@/app/actions/cv-methodology";
import { MethodologyStudio } from "@/components/clearview/MethodologyStudio";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

export default async function MethodologyEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasSupabaseServiceConfig()) return <p className="adm-msg err">Задайте SUPABASE_SERVICE_ROLE_KEY в окружении.</p>;
  let v;
  try { v = await cvGetVersion(id); } catch { notFound(); }
  const st = { draft: "черновик", review: "на утверждении", published: "действует", retired: "заменена" }[v.row.status];
  return (
    <div className="adm-wrap" style={{ maxWidth: 1320 }}>
      <Link href="/admin/methodology" className="adm-back">← Версии методологии</Link>
      <div className="adm-head">
        <div>
          <h1>ClearView {v.row.version}</h1>
          <p className="adm-sub"><span className={`adm-pill ${v.row.status === "published" ? "ok" : "warn"}`}>{st}</span>{v.row.status === "review" ? <span>утверждений: {v.row.approvals} из 2</span> : null}<span>Любая правка сразу пересчитывается на эталонных проектах справа.</span></p>
        </div>
      </div>
      <MethodologyStudio id={id} initial={v.config} baseline={v.baseline} baselineLabel={v.baselineLabel} status={v.row.status} />
    </div>
  );
}
