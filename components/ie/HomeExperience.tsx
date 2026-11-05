"use client";
import { usePublicationExpired } from "./usePublicationExpired";

import Link from "next/link";
import dynamic from "next/dynamic";
import { toMapProject } from "@/lib/project-map";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUDGET_STEPS,
  EMPTY_FILTERS,
  filterProjects,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  type HomeFilters,
} from "@/lib/home-search";
import type { HomeFeed } from "@/lib/home-feed";
import { taxLabel, zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";
import { DiscoveryHero } from "@/components/ui/DiscoveryHero";
import { projectSlug } from "@/lib/slug";
import { ProjectTile } from "./ProjectTile";
const ProjectMapPanel = dynamic(()=>import("./ProjectMapPanel").then(m=>m.ProjectMapPanel),{ssr:false,loading:()=> <p role="status">Загружаем карту проектов…</p>});

const STAGES: [string, string][] = [
  ["", "Все"],
  ["offplan", "Старт продаж"],
  ["building", "Строится"],
  ["ready", "Построенные"],
  ["unknown", "Стадия уточняется"],
];

const QUICK = [
  "вилла до 30 млн",
  "кондо у пляжа",
  "2 спальни 2027",
  "Лаян",
  "Банг-Тао",
  "сдан",
];

function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="ie-sel">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

export function HomeExperience({
  projects,
  feed,
}: {
  projects: CatalogProject[];
  feed: HomeFeed;
}) {
  const expiry = Object.values(feed.availability).map(v=>v.expiresAt).filter(v=>Date.parse(v)>Date.now()).sort()[0];
  const expired = usePublicationExpired(expiry);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(sp.toString())), [sp]);
  const pendingFilters = useRef<HomeFilters | null>(null);
  useEffect(()=>{if(pendingFilters.current && filtersToParams(pendingFilters.current).toString()===sp.toString()) pendingFilters.current=null;},[sp]);
  useEffect(()=>{const clear=()=>{pendingFilters.current=null;};window.addEventListener("popstate",clear);return()=>window.removeEventListener("popstate",clear);},[]);
  const [draft, setDraft] = useState(filters.q);
  useEffect(()=>setDraft(filters.q),[filters.q]);
  const initialLimit = hasActiveFilters(filters) ? 24 : 6;
  const [showDiscovery] = useState(() => !hasActiveFilters(filters) && filters.view !== "map");
  const [limit, setLimit] = useState(initialLimit);
  const [moreFilters, setMoreFilters] = useState<boolean | null>(null);
  const advancedCount = [filters.bedrooms, filters.ownership, filters.year].filter(Boolean).length;
  const advancedOpen = moreFilters ?? advancedCount > 0;
  const filterKey = sp.toString();
  useEffect(() => setLimit(initialLimit), [filterKey, initialLimit]);

  const apply = useCallback(
    (next: HomeFilters) => {
      pendingFilters.current = next;
      const qs = filtersToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  const set = (k: keyof HomeFilters) => (v: string) => apply({ ...(pendingFilters.current ?? filters), [k]: v });

  const zones = useMemo(() => [...new Set(projects.map((p) => p.zone))].sort(), [projects]);
  const years = useMemo(() => [...new Set(projects.map((p) => p.compY).filter((y): y is number => y != null))].sort(), [projects]);
  const list = useMemo(()=>{void expired;return filterProjects(projects, filters);},[projects,filters,expired]);
  const mapProjects = useMemo(()=>filters.view==="map" ? list.map(toMapProject) : [],[list,filters.view]);
  void expired; // The publication clock also re-evaluates budget filtering at expiry.
  const active = hasActiveFilters(filters);
  const featured = projects.find(p => feed.covers[p.id]);
  // Stage tab counts reflect every other active filter, so the numbers always add up.
  const stageCounts = (() => {
    const base = filterProjects(projects, { ...filters, stage: "" });
    return {
      "": base.length,
      offplan: base.filter((p) => p.stK === "offplan").length,
      building: base.filter((p) => p.stK === "building").length,
      ready: base.filter((p) => p.stK === "ready").length,
      unknown: base.filter((p) => p.stK === "unknown").length,
    } as Record<string, number>;
  })();

  return (
    <>
      {featured && showDiscovery ? <div className="ui-discovery-wrap"><DiscoveryHero image={feed.covers[featured.id].url} projectName={featured.n} href={`/project/${projectSlug(featured)}`} render={feed.covers[featured.id].render === true} location={zoneLabel(featured.zone, "ru")} /></div> : null}
      <section id="home-search" className="ie-hero ie-catalogue-hero" aria-labelledby="ie-h1">
        <div className="ie-wrap">
          <div className="ie-hero-copy">
            <div className="ie-eyebrow">Пхукет · Каталог новостроек</div>
            <h1 id="ie-h1">
              Новостройки Пхукета
            </h1>
            <p className="ie-hero-sub">
              Выберите район, тип недвижимости и бюджет. В карточке проекта указаны застройщик, условия предложения, источники и статус проверки.
            </p>
          </div>

          <nav className="ui-destinations" aria-label="Страны и направления">
            <a href="#home-search" aria-current="location">Таиланд · Пхукет</a>
            <Link href="/countries/thailand#locations">Другие регионы Таиланда</Link>
            <Link href="/countries/vietnam">Вьетнам <small>Раздел готовится</small></Link>
          </nav>
          <p className="ui-coverage-note">В этом каталоге представлены Пхукет и соседние районы. Бангкок, Паттайя и Хуахин доступны в разделе о Таиланде; наличие проектов указано на странице региона. Каталог Вьетнама готовится.</p>

          <form
            className="ie-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ ...(pendingFilters.current ?? filters), q: draft.trim() });
              document.getElementById("ie-results")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            }}
          >
            <div className="ie-search-row">
              <div className="ie-search-field">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Проект, застройщик, район…"
                  aria-label="Поиск по каталогу"
                />
              </div>
              <button className="ie-btn ie-btn--gold ie-search-go" type="submit">
                Найти
              </button>
            </div>
            <div className="ie-filters ie-filters--primary">
              <Select id="f-zone" label="Район" value={filters.zone} onChange={set("zone")}>
                <option value="">Все районы</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel(z, "ru")}
                  </option>
                ))}
              </Select>
              <Select id="f-type" label="Тип" value={filters.type} onChange={set("type")}>
                <option value="">Любой</option>
                {(["condo", "villa", "house"] as const).map((t) => (
                  <option key={t} value={t}>
                    {taxLabel("type", t, "ru")}
                  </option>
                ))}
              </Select>
              <Select id="f-budget" label="Бюджет" value={filters.budget} onChange={set("budget")}>
                <option value="">Любой</option>
                {BUDGET_STEPS.map((b) => (
                  <option key={b} value={b}>
                    до {b} млн ฿
                  </option>
                ))}
              </Select>
              <button type="button" className="ie-more-filters" aria-expanded={advancedOpen} aria-controls="ie-advanced-filters" onClick={() => setMoreFilters(!advancedOpen)}>
                {advancedCount ? `Дополнительно · ${advancedCount}` : advancedOpen ? "Меньше фильтров −" : "Ещё фильтры +"}
              </button>
            </div>
            <div className="ie-filters ie-filters--advanced" id="ie-advanced-filters" hidden={!advancedOpen}>
              <Select id="f-bedrooms" label="Спальни в прайсе" value={filters.bedrooms} onChange={set("bedrooms")}>
                <option value="">Любые</option>{[0,1,2,3,4,5].map(n=><option key={n} value={n}>{n===0?"Студия":`${n} спал.`}</option>)}
              </Select>
              <Select id="f-ownership" label="Владение в прайсе" value={filters.ownership} onChange={set("ownership")}>
                <option value="">Любое</option><option value="leasehold">Leasehold</option><option value="freehold">Freehold</option>
              </Select>
              <Select id="f-year" label="Сдача" value={filters.year} onChange={set("year")}>
                <option value="">Любой год</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <p className="ie-filter-help">Бюджет в ฿, только по актуальным опубликованным ценам. {advancedOpen ? "Спальни и владение — по предложениям прайса. " : ""}Проекты без подтверждённых условий не входят в результаты этих фильтров.</p>
            <div className="ie-hints">
              <span>Попробуйте:</span>
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="ie-chip"
                  onClick={() => {
                    setDraft(q);
                    apply({ ...EMPTY_FILTERS, q });
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="ie-section" id="ie-results">
        <div className="ie-wrap">
          <div className="ie-toolbar">
            <div className="ie-tabs" role="tablist" aria-label="Стадия проекта">
              {STAGES.filter(([k]) => k !== "unknown" || stageCounts.unknown > 0).map(([k, label]) => (
                <button
                  key={k || "all"}
                  type="button"
                  role="tab"
                  aria-selected={filters.stage === k}
                  className={`ie-tab${filters.stage === k ? " is-on" : ""}`}
                  onClick={() => apply({ ...(pendingFilters.current ?? filters), stage: k })}
                >
                  {label} <i>{stageCounts[k]}</i>
                </button>
              ))}
            </div>
            <div className="ie-toolbar-right">
              <div className="ie-map-mode" role="group" aria-label="Представление каталога">
                <button type="button" aria-pressed={filters.view!=="map"} onClick={()=>set("view")("list")}>Список</button>
                <button type="button" aria-pressed={filters.view==="map"} onClick={()=>set("view")("map")}>Карта</button>
              </div>
              <label className="ie-sort">
                <span>Порядок</span>
                <select value={filters.sort} onChange={(e) => set("sort")(e.target.value)} aria-label="Порядок сортировки">
                  <option value="rating">Порядок каталога</option>
                  <option value="price-asc">Сначала дешевле</option>
                  <option value="price-desc">Сначала дороже</option>
                  <option value="year">Скорее сдача</option>
                </select>
              </label>
            </div>
          </div>
          <div className="ie-resultbar" role="status" aria-live="polite" aria-atomic="true">
            <div>
              <b>{list.length}</b>{" "}
              <span style={{ color: "var(--ie-muted)", fontSize: 14 }}>
                {active ? "проектов по вашему запросу" : "проектов в каталоге"}
              </span>
            </div>
            {active ? (
              <button
                type="button"
                className="ie-btn ie-btn--line"
                onClick={() => {
                  setDraft("");
                  apply({...EMPTY_FILTERS,view:filters.view});
                }}
              >
                Сбросить фильтры
              </button>
            ) : null}
          </div>
          {list.some(p=>p.stK==="ready" && p.compY!=null && p.compY<new Date().getFullYear()-5) ? <p className="ie-small">Здесь также есть ранее построенные проекты для изучения истории застройщиков. Год постройки не означает, что в проекте сейчас продаются юниты. Для новых строек выберите соответствующую стадию.</p> : null}
          {filters.view === "map" ? <ProjectMapPanel projects={mapProjects} onZoneChange={zone=>set("zone")(zone)} /> : null}
          {list.length && filters.view !== "map" ? (
            <div className="ie-grid">
              {list.slice(0, limit).map((p) => (
                <ProjectTile key={p.id} p={p} feed={feed} />
              ))}
            </div>
          ) : null}
          {list.length > limit && filters.view !== "map" ? (
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <button type="button" className="ie-btn ie-btn--ink" onClick={() => setLimit((n) => n + 24)}>
                Показать ещё проекты · осталось {list.length - limit}
              </button>
            </div>
          ) : null}
          {list.length === 0 ? (
            <div className="ie-empty">
              <h3>Проекты по выбранным условиям не найдены</h3>
              <p>{filters.budget || filters.ownership || filters.bedrooms ? "Нет опубликованных предложений с подтверждёнными условиями под этот запрос. У части проектов цены или параметры пока неизвестны; это не означает, что они дороже бюджета или распроданы. Уберите ограничение, чтобы посмотреть их отдельно." : "Попробуйте другое название, район или снимите часть условий."}</p>
              <button
                type="button"
                className="ie-btn ie-btn--ink"
                onClick={() => {
                  setDraft("");
                  apply({...EMPTY_FILTERS,view:filters.view});
                }}
              >
                Показать все проекты
              </button>
              <p style={{ marginTop: 16 }}>
                Не нашли подходящий?{" "}
                <Link href="/market" style={{ textDecoration: "underline" }}>
                  Посмотрите весь каталог
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>

    </>
  );
}
