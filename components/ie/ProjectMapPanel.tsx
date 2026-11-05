"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clusterProjects, fitPoints, PHUKET_VIEW, projectPoint, type MapProject, type MapView } from "@/lib/project-map";
import { LOCATION_PRECISION } from "@/lib/project-location";
import { currentAvailability } from "@/lib/published-availability";
import { ownershipLabel } from "@/lib/buyer-display";
import { zoneLabel } from "@/lib/taxonomy";
import { usePublicationExpired } from "./usePublicationExpired";
import { displayDate } from "@/lib/display-date";

const groupColor = (p: MapProject) => /banyan/i.test(p.dev) ? "banyan" : /sansiri/i.test(p.dev) ? "sansiri" : /sudara/i.test(p.n) ? "sudara" : /assetwise|rhom/i.test(p.dev) ? "title" : "other";

export function ProjectMapPanel({ projects, onZoneChange, offline = false }: {
  projects: MapProject[]; onZoneChange?: (zone: string) => void; offline?: boolean;
}) {
  const [land, setLand] = useState("");
  const [landError, setLandError] = useState(false);
  const [view, setView] = useState<MapView>(PHUKET_VIEW);
  const [width, setWidth] = useState(700);
  const [selected, setSelected] = useState<number[]>([]);
  const [limit, setLimit] = useState(6);
  const [touchDrag, setTouchDrag] = useState(false);
  const [online, setOnline] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: MapView } | null>(null);
  const expiry = projects.flatMap(p=>p.sales?.publication ? [p.sales.publication.expiresAt] : []).filter(x=>Date.parse(x)>Date.now()).sort()[0];
  usePublicationExpired(expiry);
  const identity = projects.map(p=>p.id).join(",");
  useEffect(()=>{setSelected([]);setLimit(6);},[identity]);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);
  useEffect(()=>{
    const abort=new AbortController();
    fetch("/map-assets/sea-land-v1.json",{signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{if(typeof x.path!=="string")throw Error();setLand(x.path);}).catch(e=>{if(e.name!=="AbortError")setLandError(true);});
    return()=>abort.abort();
  },[]);
  useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([e])=>setWidth(e.contentRect.width));observer.observe(host.current);return()=>observer.disconnect();},[]);
  const located = useMemo(()=>projects.filter(p=>projectPoint(p)),[projects]);
  useEffect(()=>{setView(fitPoints(located,1.25));},[located]); // Camera follows the actual filtered coordinates.
  const clusters=useMemo(()=>clusterProjects(projects,view,width),[projects,view,width]);
  const unlocated=projects.filter(p=>!projectPoint(p));
  const zones=[...new Set(unlocated.map(p=>p.zone))].sort();
  const shown=selected.length ? projects.filter(p=>selected.includes(p.id)) : projects;
  const zoom=(factor:number)=>setView(v=>{const w=Math.min(35,Math.max(.003,v.width*factor)),h=w/v.width*v.height;return{x:v.x+(v.width-w)/2,y:v.y+(v.height-h)/2,width:w,height:h};});
  const pan=(x:number,y:number)=>setView(v=>({...v,x:v.x+x*v.width,y:v.y+y*v.height}));
  const radius=view.width/Math.max(240,width)*17;

  return <section className="ie-project-map" aria-label="Карта и проекты каталога">
    <div className="ie-map-intro">
      <div><span className="ie-eyebrow">Расположение и источники</span><h2 className="ie-h2">Кто где строит</h2>
        <p><b>{located.length}</b> из <b>{projects.length}</b> проектов имеют атрибутированные координаты в этом результате. Центры районов не используются вместо адресов.</p></div>
      {!offline ? <Link href="/offline-map/app" className="ie-btn ie-btn--line" prefetch={false}>Сохранить карту офлайн →</Link> : null}
    </div>
    <div className="ie-map-layout">
      <div>
        <div className={`ie-map-canvas${touchDrag ? " is-touch-drag" : ""}`} ref={host}>
          <span className="ie-map-north" aria-hidden="true">Север ↑</span>
          <svg viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" aria-label="Обзорная карта. Кнопки меток открывают проекты; стрелки перемещают карту, плюс и минус меняют масштаб." tabIndex={0}
            onKeyDown={e=>{if(e.target!==e.currentTarget)return;const actions:Record<string,()=>void>={ArrowLeft:()=>pan(-.15,0),ArrowRight:()=>pan(.15,0),ArrowUp:()=>pan(0,-.15),ArrowDown:()=>pan(0,.15),"+":()=>zoom(.6),"=":()=>zoom(.6),"-":()=>zoom(1.6)};if(actions[e.key]){e.preventDefault();actions[e.key]();}}}
            onPointerDown={e=>{if((e.target as Element).closest("[data-project-marker]"))return;if(e.pointerType==="touch"&&!touchDrag)return;drag.current={x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId);}}
            onPointerMove={e=>{const d=drag.current;if(!d)return;const rect=e.currentTarget.getBoundingClientRect();const scale=Math.max(d.view.width/rect.width,d.view.height/rect.height);setView({...d.view,x:d.view.x-(e.clientX-d.x)*scale,y:d.view.y-(e.clientY-d.y)*scale});}}
            onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
            <title>Проекты из каталога с подтверждённым источником координат</title>
            {land ? <path d={land} fillRule="evenodd" className="ie-map-land" vectorEffect="non-scaling-stroke" /> : null}
            {clusters.map(g=><g key={g.key} data-project-marker role="button" tabIndex={0} className={`ie-map-marker is-${groupColor(g.projects[0])}${g.projects.some(p=>p.location?.precision==="approximate") ? " is-approximate" : ""}`}
              aria-label={g.projects.length===1 ? `${g.projects[0].n}: ${LOCATION_PRECISION[g.projects[0].location!.precision]}` : `${g.projects.length} проекта в группе. Открыть список`}
              onClick={()=>setSelected(g.projects.map(p=>p.id))} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(g.projects.map(p=>p.id));}}}>
              <circle cx={g.x} cy={g.y} r={radius} vectorEffect="non-scaling-stroke" />
              <text x={g.x} y={g.y} fontSize={radius*.85} textAnchor="middle" dominantBaseline="central">{g.projects.length}</text>
              <title>{g.projects.map(p=>p.n).join(" · ")}</title>
            </g>)}
          </svg>
          <div className="ie-map-controls" aria-label="Управление картой">
            <button type="button" aria-label="Приблизить карту" onClick={()=>zoom(.6)}>+</button>
            <button type="button" aria-label="Отдалить карту" onClick={()=>zoom(1.6)}>−</button>
            <button type="button" aria-label="Показать все точки результата" onClick={()=>{setView(fitPoints(located,1.25));setSelected([]);}}>↔</button>
          </div>
          <button type="button" className="ie-map-touch-toggle" aria-pressed={touchDrag} onClick={()=>setTouchDrag(v=>!v)}>{touchDrag ? "Прокручивать страницу" : "Перемещать карту"}</button>
          {!land ? <div className="ie-map-loading" role="status">{landError ? "Подложка недоступна. Сведения о проектах остаются в списке." : "Загружаем подложку…"}</div> : null}
          {!located.length && land ? <div className="ie-map-no-points">Для этого результата координаты ещё не подтверждены. Проекты и районы доступны в списке рядом; случайных точек на карте нет.</div> : null}
        </div>
        <div className="ie-map-legend"><span className="is-banyan">Banyan Group</span><span className="is-sansiri">Sansiri</span><span className="is-sudara">Sudara</span><span className="is-title">The Title / AssetWise</span><span className="is-other">Другие</span><span className="is-approximate">Приблизительная точка</span></div>
        <p className="ie-map-caption">Обзорная береговая линия <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth · public domain</a>, без кадастровых границ и уличной детализации. Увеличение карты не повышает точность подложки. Число в метке — группа карточек проектов, а не число квартир. {located.some(p=>p.location?.reuseBasis==="open_data" && new URL(p.location.sourceUrl).hostname==="www.openstreetmap.org") ? <>Координаты комплексов: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>. Точка территории комплекса не определяет положение отдельного здания или юнита.</> : null}</p>
        {unlocated.length ? <div className="ie-map-unknown"><h3>{unlocated.length} проектов без подтверждённой точки</h3><p>Район — информация из карточки. Он не заменяет точное расположение; офис продаж также не считается адресом проекта.</p><div>{zones.map(zone=><button type="button" key={zone} onClick={()=>onZoneChange?.(zone)} disabled={!onZoneChange}>{zoneLabel(zone,"ru")} <b>{unlocated.filter(p=>p.zone===zone).length}</b></button>)}</div></div> : null}
      </div>
      <div className="ie-map-projects" aria-label="Проекты результата на карте и без координат">
        <div className="ie-map-list-heading" aria-live="polite"><b>{selected.length ? `В группе: ${shown.length}` : `Проектов: ${shown.length}`}</b>{selected.length ? <button type="button" onClick={()=>setSelected([])}>Все результаты</button> : null}{selected.length>1 ? <button type="button" onClick={()=>setView(fitPoints(shown,1.25))}>Приблизить группу</button> : null}</div>
        {shown.slice(0,limit).map(p=>{
          const q=projectPoint(p),a=currentAvailability(p.sales?.publication),price=a?.fromPrice;
          return <article className="ie-map-project" key={p.id}>
            <small>{p.dev} · {zoneLabel(p.zone,"ru")}</small><h3>{p.n}</h3>
            {q ? <p className="ie-map-precision">{LOCATION_PRECISION[q.precision]} · источник просмотрен {q.observedOn.split("-").reverse().join(".")}<br/>{q.note}</p> : <p className="ie-map-precision">{p.location?.precision==="sales_office" ? "Известен офис продаж; точка проекта не подтверждена" : "Координаты не подтверждены"}</p>}
            <p>{p.description.slice(0,210)}{p.description.length>210 ? "…" : ""}</p>
            <p className="ie-small">{p.dataConfirmedAt ? `Дата подтверждения характеристик: ${displayDate(p.dataConfirmedAt,true)}` : "Дата подтверждения характеристик не указана. Описание каталога требует проверки перед сделкой."}</p>
            <div className="ie-map-offer">{a ? <><b>{a.available} лотов в опубликованном прайсе</b><small>По данным на {a.observedAt} · набор может быть неполным</small></> : <b>Актуальное наличие уточняется</b>}{price ? <span>от {price.amount.toLocaleString("ru-RU")} {price.currency} · {ownershipLabel(price.ownership)}</span> : <span>Цена не подтверждена</span>}</div>
            <div className="ie-map-project-links">{q ? <button type="button" onClick={()=>{setSelected([p.id]);setView(fitPoints([p],1.25));host.current?.scrollIntoView({block:"nearest"});}}>Точка на карте</button> : null}{online ? <Link href={`/project/${p.slug}`} prefetch={false}>Проект и юниты →</Link> : <span>Страница проекта откроется при подключении</span>}{q?.sourceUrl.startsWith("https://") ? <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">Источник координат ↗</a> : null}</div>
          </article>;
        })}
        {shown.length>limit ? <button type="button" className="ie-btn ie-btn--line" onClick={()=>setLimit(n=>n+12)}>Показать ещё ({shown.length-limit})</button> : null}
      </div>
    </div>
  </section>;
}
