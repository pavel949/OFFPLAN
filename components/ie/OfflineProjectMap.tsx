"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectMapPanel } from "./ProjectMapPanel";
import { EMPTY_FILTERS, filterProjects, type HomeFilters } from "@/lib/home-search";
import type { MapSnapshot } from "@/lib/project-map";
import { zoneLabel } from "@/lib/taxonomy";
import { usePublicationExpired } from "./usePublicationExpired";
import { mapSnapshotSchema } from "@/lib/project-map-schema";

type Saved = {savedAt:string;resources:number;projects:number;bytes:number};

export function OfflineProjectMap() {
  const [snapshot,setSnapshot]=useState<MapSnapshot | null>(null);
  const [filters,setFilters]=useState<HomeFilters>({...EMPTY_FILTERS,view:"map"});
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const [progress,setProgress]=useState("");
  const [saved,setSaved]=useState<Saved | null>(null);
  const [supported,setSupported]=useState(true);
  const [online,setOnline]=useState(true);
  const registration=useRef<ServiceWorkerRegistration | null>(null);
  const downloadPort=useRef<MessagePort | null>(null);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);downloadPort.current?.close();};
  },[]);
  useEffect(()=>{
    const abort=new AbortController();
    fetch("/api/public-map",{credentials:"omit",signal:abort.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{
      setSnapshot(mapSnapshotSchema.parse(x));
    }).catch(e=>{if(e.name!=="AbortError")setError("Снимок не загружен. Для первого запуска подключитесь к интернету и сохраните карту.");});
    return()=>abort.abort();
  },[]);
  useEffect(()=>{
    if(!("serviceWorker" in navigator)){setSupported(false);return;}
    (async()=>{
      const existing=await navigator.serviceWorker.getRegistration("/offline-map/app");
      if(existing){if(navigator.onLine)existing.update().catch(()=>{});return existing;}
      return navigator.serviceWorker.register("/offline-map/sw.js",{scope:"/offline-map/"});
    })().then(async r=>{
      registration.current=r;
      // Ready only describes the isolated offline-map scope, never admin or partner pages.
      const active=r.active ?? await new Promise<ServiceWorker>((resolve,reject)=>{
        const worker=r.installing??r.waiting;if(!worker){reject(Error());return;}
        if(worker.state==="activated"){resolve(worker);return;}
        const timer=window.setTimeout(()=>reject(Error()),15000);
        worker.addEventListener("statechange",()=>{if(worker.state==="activated"){clearTimeout(timer);resolve(worker);}else if(worker.state==="redundant"){clearTimeout(timer);reject(Error());}});
      });
      const channel=new MessageChannel();channel.port1.onmessage=e=>{if(e.data.type==="STATUS"&&e.data.saved)setSaved(e.data.saved);channel.port1.close();};active.postMessage({type:"STATUS"},[channel.port2]);
    }).catch(()=>setSupported(false));
  },[]);
  const expiry=snapshot?.projects.flatMap(p=>p.sales?.publication?[p.sales.publication.expiresAt]:[]).filter(x=>Date.parse(x)>Date.now()).sort()[0];
  const expired=usePublicationExpired(expiry);
  const list=useMemo(()=>{void expired;return filterProjects(snapshot?.projects??[],filters);},[snapshot,filters,expired]);
  const zones=[...new Set(snapshot?.projects.map(p=>p.zone)??[])].sort();
  const set=(key:keyof HomeFilters,value:string)=>setFilters(f=>({...f,[key]:value}));

  async function save() {
    const worker=registration.current?.active;
    if(!worker){setError("Подготовка офлайн-режима ещё не завершена. Повторите после загрузки страницы.");return;}
    setSaving(true);setError("");setProgress("Подготавливаем файлы карты…");
    await document.fonts.ready;
    const resources=performance.getEntriesByType("resource").map(e=>e.name).filter(s=>{
      const u=new URL(s);return u.origin===location.origin&&u.pathname.startsWith("/_next/static/");
    });
    const channel=new MessageChannel();downloadPort.current=channel.port1;
    channel.port1.onmessage=e=>{
      const x=e.data;
      if(x.type==="PROGRESS")setProgress(`Сохранено файлов: ${x.done} из ${x.total}`);
      if(x.type==="SAVED"){setSaved(x.saved);setSaving(false);setProgress("Карта и публичный снимок сохранены на этом устройстве.");channel.port1.close();}
      if(x.type==="ERROR"){setError(x.message);setSaving(false);setProgress("");channel.port1.close();}
    };
    worker.postMessage({type:"SAVE_MAP",resources},[channel.port2]);
  }

  return <div className="ie-wrap ie-offline-map-page">
    <header className="ie-offline-header"><Link href="/" prefetch={false}>IGNATEV ESTATE · OFFPLAN</Link><span>{online ? "Подключено к сети" : "Офлайн"}</span></header>
    <h1 className="ie-h1">Карта, которую можно взять с собой</h1>
    <p className="ie-lead">Сохраните обзорную подложку и публичный снимок проектов на устройстве. Первый запуск и обновление требуют интернета. Карта не включает уличную навигацию; неизвестные координаты остаются неизвестными.</p>
    <div className="ie-offline-save">
      <button type="button" className="ie-btn ie-btn--gold" onClick={save} disabled={!supported||saving||!snapshot||!online}>{saving ? "Сохраняем…" : saved ? "Обновить офлайн-карту" : "Сохранить для офлайн"}</button>
      {saved ? <span>На устройстве: {saved.projects} проектов · {new Date(saved.savedAt).toLocaleString("ru-RU")} · {(saved.bytes/1024/1024).toFixed(1)} МБ</span> : <span>Карта ещё не сохранена на этом устройстве.</span>}
      <p>Браузер может удалить локальные данные при очистке хранилища. Снимок не обновляется без подключения; отправка заявок и полные страницы проектов доступны в сети. Фотографии и внешние карты в пакет не загружаются.</p>
      {!supported ? <p role="status">В этом браузере офлайн-сохранение недоступно. Карта работает при подключении.</p> : null}
      {progress ? <p role="status">{progress}</p> : null}{error ? <p role="alert">{error}</p> : null}
    </div>
    {snapshot ? <>
      <p className="ie-small">Снимок каталога: {new Date(snapshot.downloadedAt).toLocaleString("ru-RU")}. Это время загрузки, а не подтверждение цен или наличия. Даты источников указаны у предложений и координат.</p>
      <div className="ie-offline-filters">
        <label>Поиск<input aria-label="Поиск" value={filters.q} onChange={e=>set("q",e.target.value)} placeholder="Проект, застройщик, район" /></label>
        <label>Район<select aria-label="Район" value={filters.zone} onChange={e=>set("zone",e.target.value)}><option value="">Все районы</option>{zones.map(z=><option key={z} value={z}>{zoneLabel(z,"ru")}</option>)}</select></label>
        <label>Тип<select aria-label="Тип" value={filters.type} onChange={e=>set("type",e.target.value)}><option value="">Любой</option><option value="condo">Кондоминиум</option><option value="villa">Вилла</option><option value="house">Дом / таунхаус</option></select></label>
        <label>Бюджет<select aria-label="Бюджет" value={filters.budget} onChange={e=>set("budget",e.target.value)}><option value="">Любой</option>{[5,10,20,50,100].map(n=><option key={n} value={n}>до {n} млн ฿</option>)}</select></label>
        <label>Спальни в прайсе<select aria-label="Спальни в прайсе" value={filters.bedrooms} onChange={e=>set("bedrooms",e.target.value)}><option value="">Любые</option>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n===0?"Студия":n}</option>)}</select></label>
        <label>Владение в прайсе<select aria-label="Владение в прайсе" value={filters.ownership} onChange={e=>set("ownership",e.target.value)}><option value="">Любое</option><option value="leasehold">Leasehold</option><option value="freehold">Freehold</option></select></label>
      </div>
      <p className="ie-small">Бюджет и параметры покупки применяются только к ещё действующим опубликованным предложениям. Истёкшие цены и остатки скрываются и без сети.</p>
      {!list.length ? <p role="status">Нет подтверждённых предложений под эти условия. Неизвестная цена не означает, что проект дороже бюджета или распродан.</p> : null}
      <ProjectMapPanel projects={list} offline onZoneChange={zone=>set("zone",zone)} />
    </> : !error ? <p role="status">Загружаем публичный каталог…</p> : null}
  </div>;
}
