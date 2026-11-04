import "../../admin/admin.css";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Row = { id: string; version: string; title: string; status: string; change_summary: string; submitted_at: string | null; config_hash: string | null; published_at: string | null };

export default async function ReviewerMethodologyPage() {
  const db = await createSupabaseServerClient();
  if (!db) return <p style={{ padding: 24 }}>Раздел временно недоступен.</p>;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/registry/login");
  const { data: prof } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "reviewer") return <p style={{ padding: 24 }}>Раздел только для независимых аналитиков реестра.</p>;
  const { data } = await db.from("cv_methodology_versions").select("id, version, title, status, change_summary, submitted_at, config_hash, published_at").order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  const review = rows.filter((r) => r.status === "review");
  return (
    <main className="adm-wrap" style={{ margin: "0 auto", padding: "32px 16px" }}>
      <Link href="/registry/review" className="adm-back">← Кабинет эксперта</Link>
      <div className="adm-head"><div><h1>Утверждение методологии</h1><p className="adm-sub">Версию правил оценки публикуют два независимых аналитика. Вы видите содержимое версии на утверждении, публика видит только отпечаток.</p></div></div>
      <section className="adm-card"><h3>Ждут вашего решения</h3>
        {review.length === 0 ? <p className="adm-hint">Сейчас на утверждении ничего нет.</p> : (
          <table className="adm-table"><thead><tr><th>Версия</th><th>Что изменилось</th><th>Отправлена</th><th /></tr></thead><tbody>
            {review.map((r) => <tr key={r.id}><td><b>{r.version}</b></td><td style={{ maxWidth: 420 }}>{r.change_summary}</td><td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("ru-RU") : "—"}</td><td><Link className="adm-btn adm-btn--sm" href={`/registry/methodology/${r.id}`}>Открыть</Link></td></tr>)}
          </tbody></table>
        )}
      </section>
      <section className="adm-card"><h3>Опубликованные версии</h3>
        <table className="adm-table"><thead><tr><th>Версия</th><th>Статус</th><th>Опубликована</th><th>Отпечаток SHA-256</th></tr></thead><tbody>
          {rows.filter((r) => r.status === "published" || r.status === "retired").map((r) => <tr key={r.id}><td><b>{r.version}</b></td><td>{r.status === "published" ? "действует" : "заменена"}</td><td>{r.published_at ? new Date(r.published_at).toLocaleDateString("ru-RU") : "—"}</td><td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.config_hash}</td></tr>)}
        </tbody></table>
      </section>
    </main>
  );
}
