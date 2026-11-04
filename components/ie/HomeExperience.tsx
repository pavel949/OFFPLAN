"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ProjectTile } from "./ProjectTile";
import { OmbudsmanLogo } from "./OmbudsmanLogo";

const STAGES: [string, string][] = [
  ["", "Все"],
  ["offplan", "Старт продаж"],
  ["building", "Строится"],
  ["ready", "Сдан"],
];

const QUICK = [
  "вилла до 30 млн",
  "кондо у пляжа",
  "2 спальни 2027",
  "Layan",
  "Bang Tao",
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
  stats,
}: {
  projects: CatalogProject[];
  feed: HomeFeed;
  stats: { projects: number; developers: number; verified: number; updatedLabel: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(sp.toString())), [sp]);
  const [draft, setDraft] = useState(filters.q);
  const [limit, setLimit] = useState(24);
  const filterKey = sp.toString();
  useEffect(() => setLimit(24), [filterKey]);

  const apply = useCallback(
    (next: HomeFilters) => {
      const qs = filtersToParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  const set = (k: keyof HomeFilters) => (v: string) => apply({ ...filters, [k]: v });

  const zones = useMemo(() => [...new Set(projects.map((p) => p.zone))].sort(), [projects]);
  const years = useMemo(() => [...new Set(projects.map((p) => p.compY))].sort(), [projects]);
  const list = useMemo(() => filterProjects(projects, filters), [projects, filters]);
  const active = hasActiveFilters(filters);
  // Stage tab counts reflect every other active filter, so the numbers always add up.
  const stageCounts = useMemo(() => {
    const base = filterProjects(projects, { ...filters, stage: "" });
    return {
      "": base.length,
      offplan: base.filter((p) => p.stK === "offplan").length,
      building: base.filter((p) => p.stK === "building").length,
      ready: base.filter((p) => p.stK === "ready").length,
    } as Record<string, number>;
  }, [projects, filters]);

  return (
    <>
      <section className="ie-hero" aria-labelledby="ie-h1">
        <div className="ie-hero-sweep" />
        <div className="ie-horizon" />
        <div className="ie-wrap">
          <div className="ie-hero-copy">
            <div className="ie-eyebrow">Пхукет · Юго-Восточная Азия · {stats.updatedLabel}</div>
            <h1 id="ie-h1">
              Новостройки, которым можно <em>доверять</em>
            </h1>
            <p className="ie-hero-sub">
              Живые прайс-листы, наличие лотов и фотоотчёты со строек: всё от застройщиков, под контролем независимого реестра проверки.
            </p>
          </div>

          <form
            className="ie-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ ...filters, q: draft.trim() });
              document.getElementById("ie-results")?.scrollIntoView({ behavior: "smooth" });
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
            <div className="ie-filters">
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
              <Select id="f-year" label="Сдача" value={filters.year} onChange={set("year")}>
                <option value="">Любой год</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
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

      <div className="ie-strip">
        <div className="ie-wrap">
          <Link href="/protection/representative" className="ie-strip-cred" aria-label="Официальный статус: общественный представитель Уполномоченного в Таиланде">
            <OmbudsmanLogo height={38} />
            <em>Общественный представитель в Таиланде · приказ № 320-П</em>
          </Link>
          <span>Смотрите и выбирайте проекты здесь. Если нужно уточнить детали или возник конфликт с застройщиком:</span>
          <Link href="/protection">Защита прав инвесторов →</Link>
          <Link href="/protection/contact">Обратиться за помощью</Link>
        </div>
      </div>

      <section className="ie-section" id="ie-results" aria-live="polite">
        <div className="ie-wrap">
          <div className="ie-toolbar">
            <div className="ie-tabs" role="tablist" aria-label="Стадия проекта">
              {STAGES.map(([k, label]) => (
                <button
                  key={k || "all"}
                  type="button"
                  role="tab"
                  aria-selected={filters.stage === k}
                  className={`ie-tab${filters.stage === k ? " is-on" : ""}`}
                  onClick={() => apply({ ...filters, stage: k })}
                >
                  {label} <i>{stageCounts[k]}</i>
                </button>
              ))}
            </div>
            <div className="ie-toolbar-right">
              <label className="ie-sort">
                <span>Порядок</span>
                <select value={filters.sort} onChange={(e) => set("sort")(e.target.value)} aria-label="Порядок сортировки">
                  <option value="rating">Рекомендуем</option>
                  <option value="price-asc">Сначала дешевле</option>
                  <option value="price-desc">Сначала дороже</option>
                  <option value="year">Скорее сдача</option>
                </select>
              </label>
            </div>
          </div>
          <div className="ie-resultbar">
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
                  apply(EMPTY_FILTERS);
                }}
              >
                Сбросить фильтры
              </button>
            ) : null}
          </div>
          {list.length ? (
            <div className="ie-grid">
              {list.slice(0, limit).map((p) => (
                <ProjectTile key={p.id} p={p} feed={feed} />
              ))}
            </div>
          ) : null}
          {list.length > limit ? (
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <button type="button" className="ie-btn ie-btn--ink" onClick={() => setLimit((n) => n + 24)}>
                Показать ещё ({list.length - limit})
              </button>
            </div>
          ) : null}
          {list.length === 0 ? (
            <div className="ie-empty">
              <h3>Ничего не нашлось</h3>
              <p>Попробуйте убрать часть условий или расширить бюджет.</p>
              <button
                type="button"
                className="ie-btn ie-btn--ink"
                onClick={() => {
                  setDraft("");
                  apply(EMPTY_FILTERS);
                }}
              >
                Показать все проекты
              </button>
              <p style={{ marginTop: 16 }}>
                Не нашли подходящий?{" "}
                <Link href="/market" style={{ textDecoration: "underline" }}>
                  Откройте расширенный каталог с аналитикой
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="ie-trustband" aria-label="О каталоге">
        <div className="ie-wrap">
          <div className="ie-trust">
            <div>
              <b>{stats.projects}</b>
              <small>проектов в каталоге</small>
            </div>
            <div>
              <b>{stats.developers}</b>
              <small>застройщиков с досье</small>
            </div>
            <div>
              {stats.verified > 0 ? (
                <>
                  <b>{stats.verified}</b>
                  <small>проектов прошли проверку реестра</small>
                </>
              ) : (
                <>
                  <b>3 уровня</b>
                  <small>проверки: заявлено, документы, независимая проверка</small>
                </>
              )}
            </div>
            <div>
              <b>30 дней</b>
              <small>цены без подтверждения старше этого срока скрываются</small>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
