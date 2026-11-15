import Link from "next/link";
import { STATUS_RU, type PartnerProject } from "@/lib/partner-projects";

/** Where each checklist step is done in the developer cabinet. */
export const TAB_OF: Record<string, string> = { price: "/inventory", units: "/inventory", photo: "/facts", photos: "/facts", links: "/materials", news: "/updates" };

export function ProjectsList({ projects, isOwner }: { projects: PartnerProject[]; isOwner: boolean }) {
  return (
    <section className="adm-card">
      <h3>Мои проекты</h3>
      {projects.length === 0 ? (
        <p className="adm-lead">Пока нет проектов. {isOwner ? "Добавьте первый: понадобятся название, район, цена и описание." : "Владелец компании может добавить проект."}</p>
      ) : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>Проект</th><th>Статус</th><th className="num">Лоты</th><th className="num">Фото</th><th>Заполненность</th><th>Следующий шаг</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                const st = STATUS_RU[p.status] ?? { label: p.status, cls: "" };
                return (
                  <tr key={p.id}>
                    <td><Link className="name" href={`/partner/projects/${p.id}`}>{p.name}</Link><div className="adm-hint">{p.zone}</div></td>
                    <td><span className={`adm-pill ${st.cls}`}>{st.label}</span></td>
                    <td className={`num${p.units ? "" : " adm-zero"}`}>{p.units}</td>
                    <td className={`num${p.photos ? "" : " adm-zero"}`}>{p.photos}{p.photosPending ? <span className="adm-hint"> +{p.photosPending}</span> : null}</td>
                    <td style={{ minWidth: 130 }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div className={`adm-bar${p.score === 100 ? " full" : ""}`} style={{ flex: 1 }}><b style={{ width: `${p.score}%` }} /></div><span className="adm-hint">{p.score}%</span></div></td>
                    <td>{p.next ? <Link href={`/partner/projects/${p.id}${TAB_OF[p.next.key] ?? ""}`} style={{ textDecoration: "underline", fontWeight: 700 }}>{p.next.label}</Link> : <span className="adm-pill ok">всё заполнено</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
