import type { ProjectEvidence } from "@/lib/project-evidence";
import { mediaForUnit, mediaLabel } from "@/lib/project-media";
export function UnitMedia({facts,unitId,lang}:{facts:ProjectEvidence[];unitId:string;lang:"ru"|"en"}) {
  const items=mediaForUnit(facts,unitId),ru=lang === "ru";
  return items.length ? <div className="ie-unit-media"><p className="ie-small">{ru ? "Материалы, привязанные к этому лоту. Дата источника не подтверждает текущее состояние." : "Materials linked to this unit. Source dates do not establish its current condition."}</p><div className="ie-gallery">{items.map(f=><a className="ie-shot" key={f.id} href={String(f.details.url)} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${f.title} · ${mediaLabel(f.details,lang)}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={String(f.details.url)} alt={String(f.details.caption ?? f.title)} loading="lazy" referrerPolicy="no-referrer" style={{width:"100%",height:"100%",objectFit:"contain"}}/><span>{mediaLabel(f.details,lang)} · {f.observed_at}</span>
  </a>)}</div><ul className="ie-small">{items.map(f=><li key={f.id}><a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow">{f.title} · {ru ? "источник" : "source"}</a></li>)}</ul></div> : <p className="ie-small">{ru ? "Фото и планировка именно этого лота пока не добавлены. Это не означает, что у застройщика их нет." : "Photos and a floor plan for this exact unit have not been added. The developer may have additional materials."} <a href="#project-photos">{ru ? "Материалы проекта" : "Project materials"}</a></p>;
}
