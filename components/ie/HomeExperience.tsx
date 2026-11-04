"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
              Проверенные проекты, живые прайс-листы и наличие лотов, фотоотчёты со строек и акции:
              всё от самих застройщиков и под контролем независимого реестра проверки.
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
              <Select id="f-stage" label="Стадия" value={filters.stage} onChange={set("stage")}>
                <option value="">Любая</option>
                <option value="offplan">Старт продаж</option>
                <option value="building">Строится</option>
                <option value="ready">Сдан</option>
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
              <Select id="f-sort" label="Порядок" value={filters.sort} onChange={set("sort")}>
                <option value="rating">Рекомендуем</option>
                <option value="price-asc">Сначала дешевле</option>
                <option value="price-desc">Сначала дороже</option>
                <option value="year">Скорее сдача</option>
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

      <section className="ie-section" id="ie-results" aria-live="polite">
        <div className="ie-wrap">
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
              {list.map((p) => (
                <ProjectTile key={p.id} p={p} feed={feed} />
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </section>
    </>
  );
}
