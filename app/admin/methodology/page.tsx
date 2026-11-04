import Link from "next/link";
import { cvListVersions, type VersionRow } from "@/app/actions/cv-methodology";
import { NewDraftButton } from "@/components/clearview/NewDraftButton";
import { shortHash } from "@/lib/clearview/hash";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "warn" }, review: { label: "На утверждении", cls: "warn" }, published: { label: "Действует", cls: "ok" }, retired: { label: "Заменена", cls: "" },
};

export default async function AdminMethodologyPage() {
  if (!hasSupabaseServiceConfig()) return <p className="adm-msg err">Задайте SUPABASE_SERVICE_ROLE_KEY в окружении.</p>;
  let rows: VersionRow[] = [];
  let err: string | null = null;
  try { rows = await cvListVersions(); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div>
          <h1>Методология ClearView</h1>
          <p className="adm-sub">Версии правил оценки. Содержимое закрыто: публично видны только номер версии и отпечаток. Публикуют версию двое независимых аналитиков, после чего она неизменяема, а оценка проекта закрепляется за версией на момент заказа.</p>
        </div>
        <NewDraftButton />
      </div>
      {err ? <p className="adm-msg err">{err}</p> : null}
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>Версия</th><th>Название</th><th>Статус</th><th>Утверждения</th><th>Отпечаток</th><th>Что изменилось</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS[r.status];
              return (
                <tr key={r.id}>
                  <td><Link className="name" href={`/admin/methodology/${r.id}`}>{r.version}</Link></td>
                  <td>{r.title}</td>
                  <td><span className={`adm-pill ${st.cls}`}>{st.label}</span></td>
                  <td>{r.status === "review" ? `${r.approvals} из 2${r.returns ? `, возвратов: ${r.returns}` : ""}` : "—"}</td>
                  <td className="adm-hint" style={{ fontFamily: "monospace" }}>{r.config_hash ? shortHash(r.config_hash) : "—"}</td>
                  <td style={{ maxWidth: 320 }}>{r.change_summary || "—"}</td>
                  <td><Link className="adm-btn adm-btn--sm" href={`/admin/methodology/${r.id}`}>Открыть</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !err ? <p className="adm-hint" style={{ padding: 16 }}>Версий пока нет. Создайте черновик: он начнётся с рекомендуемой версии 2.2 (Atlas v2.1 с поправками калибровки).</p> : null}
      </div>
    </div>
  );
}
