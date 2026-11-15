import Link from "next/link";
import { cvListVersions, type VersionRow } from "@/app/actions/cv-methodology";
import { NewDraftButton } from "@/components/clearview/NewDraftButton";
import { shortHash } from "@/lib/clearview/hash";
import { requireOwner } from "@/lib/owner";
import { hasSupabaseServiceConfig } from "@/lib/supabase/service";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "warn" }, review: { label: "На утверждении", cls: "warn" }, published: { label: "Действует", cls: "ok" }, retired: { label: "Заменена", cls: "" },
};

export const dynamic = "force-dynamic";

export default async function OwnerMethodologyPage() {
  await requireOwner();
  if (!hasSupabaseServiceConfig()) return <p className="adm-msg err">Задайте SUPABASE_SERVICE_ROLE_KEY в окружении.</p>;
  let rows: VersionRow[] = [];
  let err: string | null = null;
  try { rows = await cvListVersions(); } catch (e) { err = e instanceof Error ? e.message : String(e); }
  return (
    <div className="adm-wrap" style={{ margin: "0 auto" }}>
      <div className="adm-head">
        <div>
          <h1>Методология ClearView</h1>
          <p className="adm-sub">Версии правил оценки. Содержимое закрыто: публично видны только номер версии, способ утверждения и отпечаток. Вы можете опубликовать версию сами (публично это будет указано) или отправить её двум независимым аналитикам. Опубликованные версии сохраняются в истории.</p>
        </div>
        <NewDraftButton />
      </div>
      {err ? <p className="adm-msg err">{err}</p> : null}
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr><th>Версия</th><th>Название</th><th>Статус</th><th>Утверждения</th><th>Утверждение</th><th>Отпечаток</th><th>Что изменилось</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = STATUS[r.status];
              return (
                <tr key={r.id}>
                  <td><Link className="name" href={`/owner/methodology/${r.id}`}>{r.version}</Link></td>
                  <td>{r.title}</td>
                  <td><span className={`adm-pill ${st.cls}`}>{st.label}</span></td>
                  <td>{r.status === "review" ? `${r.approvals} из 2${r.returns ? `, возвратов: ${r.returns}` : ""}` : "—"}</td>
                  <td>{r.approval_mode === "owner" ? "владелец" : r.approval_mode === "dual" ? "два аналитика" : "—"}</td>
                  <td className="adm-hint" style={{ fontFamily: "monospace" }}>{r.config_hash ? shortHash(r.config_hash) : "—"}</td>
                  <td style={{ maxWidth: 320 }}>{r.change_summary || "—"}</td>
                  <td><Link className="adm-btn adm-btn--sm" href={`/owner/methodology/${r.id}`}>Открыть</Link></td>
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
