"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toggleFavoriteLegacy } from "@/app/actions/favorites";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { localizeProject } from "@/lib/i18n/localize-project";
import { zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";
import {
  activeFilterCount,
  applyFilters,
  defaultFilterState,
  type FilterState,
} from "@/lib/filters";
import {
  filtersFromSearchParams,
  filtersToSearchParams,
} from "@/lib/url-filters";
import { ProjectCard } from "./ProjectCard";
import { marketFilters } from "@/lib/market-evidence";
import { CalculatorPanel } from "./CalculatorPanel";
import { LeadModal } from "./LeadModal";

const SL_KEY = "phuket_sl";
const LANG_KEY = "phuket_lang";

type TabId =
  | "catalog"
  | "analytics"
  | "risk"
  | "devs"
  | "calc"
  | "shortlist"
  | "services";

function parseTab(s: string | null): TabId {
  const allowed: TabId[] = [
    "catalog",
    "analytics",
    "risk",
    "devs",
    "calc",
    "shortlist",
    "services",
  ];
  if (s && allowed.includes(s as TabId)) return s as TabId;
  return "catalog";
}

function getShortlistIds(): number[] {
  try {
    const raw = localStorage.getItem(SL_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

export function CatalogueShell({ projects }: { projects: CatalogProject[] }) {
  const zones = [...new Set(projects.map(p => p.zone))].sort();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadProjectId, setLeadProjectId] = useState<number | null>(null);
  const [leadProjectName, setLeadProjectName] = useState<string | null>(null);

  useEffect(() => {
    const l = localStorage.getItem(LANG_KEY);
    if (l === "ru" || l === "en") setLang(l);
    setShortlist(getShortlistIds());
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || cancelled) return;
      const { data: rows } = await supabase
        .from("favorites")
        .select("catalog_projects(legacy_id)")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      const legacyIds = (rows ?? [])
        .map((r) => {
          const cp = r.catalog_projects as { legacy_id?: number } | null;
          return cp?.legacy_id != null ? Number(cp.legacy_id) : null;
        })
        .filter((x): x is number => x != null && Number.isFinite(x));
      const local = getShortlistIds();
      const merged = [...new Set([...local, ...legacyIds])];
      localStorage.setItem(SL_KEY, JSON.stringify(merged));
      setShortlist(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  const tab = parseTab(searchParams.get("tab"));

  const filters = useMemo((): FilterState => {
    const f = marketFilters(filtersFromSearchParams(searchParams));
    return f;
  }, [searchParams]);

  const setFilters = useCallback(
    (next: FilterState) => {
      const tabParam = searchParams.get("tab");
      const o = new URLSearchParams();
      if (tabParam) o.set("tab", tabParam);
      const fp = filtersToSearchParams(marketFilters(next));
      for (const [k, v] of Object.entries(fp)) {
        if (v) o.set(k, v);
      }
      router.replace(`?${o.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setTab = useCallback(
    (t: TabId) => {
      const o = new URLSearchParams(searchParams.toString());
      o.set("tab", t);
      router.replace(`?${o.toString()}`, { scroll: false });
      setSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, searchParams],
  );

  const toggleLang = () => {
    const n = lang === "en" ? "ru" : "en";
    setLang(n);
    localStorage.setItem(LANG_KEY, n);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const openLeadModal = (project: CatalogProject | null) => {
    if (project) {
      setLeadProjectId(project.id);
      setLeadProjectName(project.n);
    } else {
      setLeadProjectId(null);
      setLeadProjectName(null);
    }
    setLeadOpen(true);
  };

  const closeLeadModal = () => {
    setLeadOpen(false);
  };

  const toggleShortlist = (id: number) => {
    setShortlist((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem(SL_KEY, JSON.stringify(next));
      const add = !prev.includes(id);
      void toggleFavoriteLegacy(id, add).catch(() => {});
      return next;
    });
  };

  const clearShortlist = () => {
    setShortlist([]);
    localStorage.setItem(SL_KEY, "[]");
  };

  const view = useMemo(
    () => projects.map((p) => localizeProject(p, lang)),
    [projects, lang],
  );

  const filtered = useMemo(() => applyFilters(view, filters), [view, filters]);

  const badge = activeFilterCount(filters);

  const resetFilters = () => {
    setFilters(defaultFilterState());
  };

  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => {
    setFilters({ ...filters, [key]: value });
  };

  const shortlistProjects = useMemo(
    () => view.filter((p) => shortlist.includes(p.id)),
    [view, shortlist],
  );

  return (
    <div data-lang={lang}>
      <LeadModal
        open={leadOpen}
        onClose={closeLeadModal}
        lang={lang}
        projectId={leadProjectId}
        projectName={leadProjectName}
      />
      <header className="hdr">
        <div className="hdr-logo">
          <div className="hdr-lm">
            <svg viewBox="0 0 28 28" aria-hidden>
              <path d="M4 24V10L14 4L24 10V24H17V17H11V24Z" />
            </svg>
          </div>
          <div className="hdr-brand">
            <h1>Ignatev Estate</h1>
            <p>Phuket Property Catalogue</p>
          </div>
        </div>
        <div className="hdr-div" />
        <div className="hdr-kpis">
          <div className="hkpi">
            <div className="hkpi-v">{projects.length}</div>
            <div className="hkpi-l">
              <span className="i-en">Projects</span>
              <span className="i-ru">Проектов</span>
            </div>
          </div>
        </div>
        <div className="hdr-acts">
          <button
            type="button"
            className="filter-btn"
            onClick={() => openLeadModal(null)}
            style={{ marginRight: 4 }}
          >
            <span className="i-en">✉ Inquiry</span>
            <span className="i-ru">✉ Заявка</span>
          </button>
          <Link href="/login" className="lang-btn" style={{ textDecoration: "none" }}>
            <span className="i-en">Sign in</span>
            <span className="i-ru">Войти</span>
          </Link>
          <button type="button" className="lang-btn" onClick={toggleLang}>
            {lang === "en" ? "🇷🇺 РУС" : "🇬🇧 ENG"}
          </button>
          <button
            type="button"
            className="filter-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="i-en">⚙ Filters</span>
            <span className="i-ru">⚙ Фильтры</span>
            <span
              className="fbadge"
              style={{ display: badge > 0 ? "inline-flex" : "none" }}
            >
              {badge}
            </span>
          </button>
        </div>
      </header>

      <div
        className={`overlay${sidebarOpen ? " show" : ""}`}
        role="presentation"
        onClick={() => setSidebarOpen(false)}
      />

      <div className="layout">
        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sb-hdr">
            <span className="sb-title">
              <span className="i-en">Filter & Sort</span>
              <span className="i-ru">Фильтры</span>
            </span>
            <button
              type="button"
              className="sb-close"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="sb-body">
            <div className="fg">
              <label className="fg-lbl" htmlFor="sales-filter">
                {lang === "ru" ? "Продажи и наличие" : "Sales and availability"}
              </label>
              <select
                id="sales-filter"
                value={filters.fSales}
                onChange={(e) => updateFilter("fSales", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Все стадии продаж" : "All sales stages"}
                </option>
                <option value="prelaunch">
                  {lang === "ru" ? "До старта продаж" : "Prelaunch"}
                </option>
                <option value="launch">
                  {lang === "ru" ? "Старт продаж" : "Launch"}
                </option>
                <option value="selling">
                  {lang === "ru" ? "Продажи идут" : "Selling"}
                </option>
                <option value="last_units">
                  {lang === "ru" ? "Последние лоты" : "Last units"}
                </option>
                <option value="available">
                  {lang === "ru"
                    ? "Есть внесённые свободные лоты"
                    : "Recorded available units"}
                </option>
                <option value="sold_out">
                  {lang === "ru"
                    ? "Продано (подтверждено)"
                    : "Confirmed sold out"}
                </option>
              </select>
            </div>
            <div className="fg fg-sort">
              <div className="fg-lbl">
                <span className="i-en">Sort by</span>
                <span className="i-ru">Сортировка</span>
              </div>
              <select
                value={filters.fSort}
                onChange={(e) =>
                  updateFilter("fSort", e.target.value as FilterState["fSort"])
                }
              >
                <option value="name">{lang === "ru" ? "Название А–Я" : "Name A–Z"}</option>
                <option value="comp_asc">
                  {lang === "ru"
                    ? "Срок сдачи — ближайший"
                    : "Completion — soonest"}
                </option>
                <option value="price_asc">
                  {lang === "ru" ? "Цена ↑" : "Price ↑"}
                </option>
                <option value="price_desc">
                  {lang === "ru" ? "Цена ↓" : "Price ↓"}
                </option>

                <option value="beach">
                  {lang === "ru" ? "Близость к пляжу" : "Beach proximity"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Search</span>
                <span className="i-ru">Поиск</span>
              </div>
              <input
                type="text"
                value={filters.q}
                onChange={(e) => updateFilter("q", e.target.value)}
                placeholder="Project, developer, zone..."
              />
            </div>

            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Segment</span>
                <span className="i-ru">Сегмент</span>
              </div>
              <select
                value={filters.fSeg}
                onChange={(e) => updateFilter("fSeg", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Все сегменты" : "All segments"}
                </option>
                <option value="branded">
                  {lang === "ru"
                    ? "Брендированные и ультра-люкс"
                    : "Ultra-Luxury & Branded"}
                </option>
                <option value="condo">
                  {lang === "ru" ? "Инвестиционные кондо" : "Investment Condo"}
                </option>
                <option value="villa-lux">
                  {lang === "ru"
                    ? "Виллы люкс от ฿30 млн"
                    : "Villa Luxury ฿30M+"}
                </option>
                <option value="villa-mid">
                  {lang === "ru"
                    ? "Виллы премиум ฿12–30 млн"
                    : "Villa Premium ฿12–30M"}
                </option>
                <option value="villa-entry">
                  {lang === "ru"
                    ? "Виллы входного уровня ฿6–12 млн"
                    : "Villa Entry ฿6–12M"}
                </option>
                <option value="completed">
                  {lang === "ru"
                    ? "Сданные в 2024–2025 гг."
                    : "Completed 2024–25"}
                </option>
                <option value="offplan-new">
                  {lang === "ru"
                    ? "Новый оффплан 2026–2028"
                    : "New Off-Plan 2026–28"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Type</span>
                <span className="i-ru">Тип</span>
              </div>
              <select
                value={filters.fType}
                onChange={(e) => updateFilter("fType", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Все типы" : "All types"}
                </option>
                <option value="condo">
                  {lang === "ru" ? "Кондоминиум" : "Condominium"}
                </option>
                <option value="villa">
                  {lang === "ru"
                    ? "Вилла / вилла с бассейном"
                    : "Villa / Pool Villa"}
                </option>
                <option value="house">
                  {lang === "ru" ? "Дом / таунхаус" : "House / Townhouse"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Zone</span>
                <span className="i-ru">Зона</span>
              </div>
              <select
                value={filters.fZone}
                onChange={(e) => updateFilter("fZone", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Все районы" : "All zones"}
                </option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel(z, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Status</span>
                <span className="i-ru">Статус</span>
              </div>
              <select
                value={filters.fStatus}
                onChange={(e) => updateFilter("fStatus", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Любой статус" : "Any status"}
                </option>
                <option value="ready">
                  {lang === "ru" ? "Сданные / в наличии" : "Ready / Inventory"}
                </option>
                <option value="building">
                  {lang === "ru" ? "Строятся" : "Under construction"}
                </option>
                <option value="offplan">
                  {lang === "ru"
                    ? "Оффплан / предпродажа"
                    : "Off-plan / Pre-sale"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Completion</span>
                <span className="i-ru">Год сдачи</span>
              </div>
              <select
                value={filters.fYear}
                onChange={(e) => updateFilter("fYear", e.target.value)}
              >
                <option value="">
                  {lang === "ru" ? "Любой год" : "Any year"}
                </option>
                <option value="done24">
                  {lang === "ru" ? "Сданы в 2024 г." : "Built 2024"}
                </option>
                <option value="done25">
                  {lang === "ru" ? "Сданы в 2025 г." : "Built 2025"}
                </option>
                <option value="2026">
                  {lang === "ru" ? "Сдача в 2026 г." : "Delivering 2026"}
                </option>
                <option value="2027">
                  {lang === "ru" ? "Сдача в 2027 г." : "Delivering 2027"}
                </option>
                <option value="2028">
                  {lang === "ru" ? "2028 г. и позже" : "2028+"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Beach</span>
                <span className="i-ru">До пляжа</span>
              </div>
              <select
                value={filters.fBeach}
                onChange={(e) => updateFilter("fBeach", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Любое" : "Any"}</option>
                <option value="bf">
                  {lang === "ru" ? "Первая линия" : "Beachfront"}
                </option>
                <option value="500">
                  {lang === "ru" ? "До 500 м" : "Under 500m"}
                </option>
                <option value="1k">
                  {lang === "ru" ? "До 1 км" : "Under 1km"}
                </option>
                <option value="inl">
                  {lang === "ru" ? "Вдали от пляжа" : "Inland"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Ownership</span>
                <span className="i-ru">Владение</span>
              </div>
              <select
                value={filters.fOwn}
                onChange={(e) => updateFilter("fOwn", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Любое" : "Any"}</option>
                <option value="fh">
                  {lang === "ru" ? "Фрихолд (кондо)" : "Freehold condo"}
                </option>
                <option value="lh">
                  {lang === "ru" ? "Лизхолд" : "Leasehold"}
                </option>
                <option value="both">
                  {lang === "ru" ? "Оба варианта" : "Both"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Management</span>
                <span className="i-ru">Управление</span>
              </div>
              <select
                value={filters.fMgmt}
                onChange={(e) => updateFilter("fMgmt", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Любое" : "Any"}</option>
                <option value="hotel">
                  {lang === "ru" ? "Гостиничный бренд" : "Hotel brand"}
                </option>
                <option value="pro">
                  {lang === "ru" ? "Управляющая компания" : "Professional"}
                </option>
                <option value="self">
                  {lang === "ru" ? "Самоуправление" : "Self-managed"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Focus</span>
                <span className="i-ru">Фокус</span>
              </div>
              <select
                value={filters.fFocus}
                onChange={(e) => updateFilter("fFocus", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Любое" : "Any"}</option>
                <option value="STR">
                  {lang === "ru" ? "Краткосрочная аренда (STR)" : "STR"}
                </option>
                <option value="LTR">
                  {lang === "ru" ? "Долгосрочная аренда (LTR)" : "LTR"}
                </option>
                <option value="growth">
                  {lang === "ru" ? "Рост капитала" : "Capital growth"}
                </option>
                <option value="lifestyle">
                  {lang === "ru" ? "Для проживания" : "Lifestyle"}
                </option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Developer</span>
                <span className="i-ru">Застройщик</span>
              </div>
              <select
                value={filters.fDev}
                onChange={(e) => updateFilter("fDev", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Все" : "All"}</option>
                <option value="AssetWise">AssetWise / TITLE</option>
                <option value="Sansiri">Sansiri</option>
                <option value="Banyan">Banyan / Laguna</option>
                <option value="Origin">Origin Property</option>
                <option value="Botanica">Botanica</option>
                <option value="Minor">Minor / Anantara</option>
                <option value="Supalai">Supalai</option>
                <option value="Siamese">Siamese Asset</option>
                <option value="CharnIssara">Charn Issara</option>
                <option value="MontAzure">MontAzure / Accor</option>
                <option value="WorldCorp">World Corporation PCL</option>
              </select>
            </div>
            <div className="fg">
              <div className="fg-lbl">
                <span className="i-en">Registry verification</span>
                <span className="i-ru">Верификация реестра</span>
              </div>
              <select
                value={filters.fVer}
                onChange={(e) => updateFilter("fVer", e.target.value)}
              >
                <option value="">{lang === "ru" ? "Любая" : "Any"}</option>
                <option value="1">
                  {lang === "ru"
                    ? "L1 и выше — документы проверены"
                    : "L1+ — documents verified"}
                </option>
                <option value="2">
                  {lang === "ru"
                    ? "L2 — независимая проверка"
                    : "L2 — independent verification"}
                </option>
              </select>
            </div>
          </div>
          <div className="sb-foot">
            <button
              type="button"
              className="btn-apply"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="i-en">Show results</span>
              <span className="i-ru">Показать</span>
            </button>
            <button type="button" className="btn-reset" onClick={resetFilters}>
              <span className="i-en">Reset</span>
              <span className="i-ru">Сброс</span>
            </button>
          </div>
        </aside>

        <main className="main">
          <div
            className="hero"
            style={{ display: tab === "catalog" ? undefined : "none" }}
          >
            <div className="hero-in">
              <h2>
                <span className="i-en">
                  Phuket Property <em>Catalogue</em>
                </span>
                <span className="i-ru">
                  Каталог недвижимости <em>Пхукета</em>
                </span>
              </h2>
              <p className="hero-sub">
                Ignatev Estate ·{" "}
                <span className="i-en">Project information and evidence</span>
                <span className="i-ru">Данные проектов и источники</span>
              </p>
              <div className="hero-kpis">
                <div className="hkpi2">
                  <div className="hkpi2-v">{projects.length}</div>
                  <div className="hkpi2-l">
                    <span className="i-en">Published projects</span>
                    <span className="i-ru">Проектов</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div
            className="topbar"
            style={{ display: tab === "catalog" ? undefined : "none" }}
          >
            <span className="tb-cnt">
              <strong>{filtered.length}</strong>{" "}
              <span className="i-en">projects</span>
              <span className="i-ru">проектов</span>
            </span>
            <div className="chips-row" />
          </div>

          <nav className="nav-tabs">
            {(
              [
                ["catalog", "All Projects", "Все проекты"],
                ["analytics", "Market Analytics", "Аналитика рынка"],
                ["risk", "Risk & Due Diligence", "Риски и Due Diligence"],
                ["devs", "Developers", "Застройщики"],
                ["calc", "Calculator", "Калькулятор"],
                ["shortlist", "♥ Shortlist", "♥ Шортлист"],
                ["services", "📞 Services", "📞 Услуги"],
              ] as const
            ).map(([id, en, ru]) => (
              <button
                key={id}
                type="button"
                className={`nt${tab === id ? " on" : ""}`}
                onClick={() => setTab(id)}
              >
                <span className="i-en">{en}</span>
                <span className="i-ru">{ru}</span>
              </button>
            ))}
          </nav>

          {tab === "catalog" && (
            <div className="tcontent content">
              <div className="disc">
                <span className="i-en">Catalogue information is not a purchase recommendation. Review each project’s sources, evidence dates and unanswered questions. Published listings and registry labels do not replace independent due diligence.</span>
                <span className="i-ru">Сведения каталога не являются рекомендацией покупать. Смотрите источники, даты проверки и открытые вопросы в карточке каждого проекта. Публикация и статус реестра не заменяют независимую проверку.</span>
              </div>
              <div className="cgrid">
                {filtered.length === 0 ? (
                  <div className="no-res">
                    <h3>
                      {lang === "ru"
                        ? "Проекты не найдены"
                        : "No projects found"}
                    </h3>
                    <p>
                      <button
                        type="button"
                        className="btn-reset"
                        onClick={resetFilters}
                      >
                        {lang === "ru" ? "Сбросить фильтры" : "Reset filters"}
                      </button>
                    </p>
                  </div>
                ) : (
                  filtered.map((p) => (
                    <ProjectCard
                      key={p.id}
                      p={p}
                      lang={lang}
                      inShortlist={shortlist.includes(p.id)}
                      onToggleShortlist={() => toggleShortlist(p.id)}
                      onRequestLead={() => openLeadModal(p)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div className="tcontent content">
              <div>
                <p>
                  {lang === "ru"
                    ? "Рыночная аналитика появится после проверки источников. Прогнозы доходности не публикуются."
                    : "Market analytics await source verification. Return forecasts are not published."}
                </p>
              </div>
            </div>
          )}
          {tab === "risk" && (
            <div className="tcontent content">
              <h2>{lang === "ru" ? "Риски требуют документов" : "Risk conclusions require evidence"}</h2>
              <p>{lang === "ru" ? "Числовые рейтинги и категории риска не публикуются без проверенного отчёта. Наличие проекта в каталоге не означает, что он прошёл независимую проверку." : "Numerical ratings and risk tiers are not published without a reviewed report. Catalogue inclusion does not mean a project has undergone independent review."}</p>
              <p><Link href="/methodology">{lang === "ru" ? "Что проверяем и как читаем документы" : "What we review and how we use evidence"}</Link></p>
              <p><Link href="/quick-assessment">{lang === "ru" ? "Составить список вопросов по проекту" : "Build a project checklist"}</Link></p>
            </div>
          )}
          {tab === "devs" && (
            <div className="tcontent content">
              <div>
                <h2>
                  {lang === "ru"
                    ? "Застройщики опубликованных проектов"
                    : "Developers with published projects"}
                </h2>
                {[...new Set(projects.map((p) => p.dt))].map((code) => (
                  <p key={code}>
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("fDev", code);
                        setTab("catalog");
                      }}
                    >
                      {projects.find((p) => p.dt === code)?.dev} ·{" "}
                      {projects.filter((p) => p.dt === code).length}
                    </button>
                  </p>
                ))}
                <p>
                  {lang === "ru"
                    ? "История строится из опубликованных проектов. Она не подтверждает финансовую надёжность застройщика."
                    : "History comes from published projects and does not establish financial reliability."}
                </p>
              </div>
            </div>
          )}
          {tab === "calc" &&
            process.env.NEXT_PUBLIC_ENABLE_RETURN_SCENARIOS === "true" && (
              <CalculatorPanel
                lang={lang}
                benchmarksHtml=""
              />
            )}
          {tab === "calc" && process.env.NEXT_PUBLIC_ENABLE_RETURN_SCENARIOS !== "true" && (
            <div className="tcontent content"><h2>{lang === "ru" ? "Расчёт по подтверждённым расходам" : "Calculations need confirmed costs"}</h2><p>{lang === "ru" ? "Прогноз доходности сейчас не доступен. Проверьте расходы на обслуживание и условия управления в карточке выбранного проекта; неизвестные суммы не заменяются средними значениями." : "Return forecasts are currently unavailable. Check maintenance costs and management terms on the selected project page; unknown amounts are not replaced by averages."}</p><Link href="/">{lang === "ru" ? "Выбрать проект" : "Choose a project"}</Link></div>
          )}
          {tab === "shortlist" && (
            <div className="tcontent content">
              <div className="sh">
                <span className="i-en">♥ My Shortlist</span>
                <span className="i-ru">♥ Мой шортлист</span>
              </div>
              <p className="ss">
                <span className="i-en">
                  Projects saved to your shortlist. Stored locally in your
                  browser.
                </span>
                <span className="i-ru">
                  Проекты, добавленные в шортлист. Хранятся в вашем браузере.
                </span>
              </p>
              <div className="sl-toolbar">
                <span className="sl-count">
                  {shortlist.length} <span className="i-en">projects</span>
                  <span className="i-ru">проектов</span>
                </span>
                <button
                  type="button"
                  className="sl-clear"
                  onClick={clearShortlist}
                >
                  <span className="i-en">Clear all</span>
                  <span className="i-ru">Очистить всё</span>
                </button>
              </div>
              <div className="cgrid">
                {shortlistProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    p={p}
                    lang={lang}
                    inShortlist
                    onToggleShortlist={() => toggleShortlist(p.id)}
                    onRequestLead={() => openLeadModal(p)}
                  />
                ))}
              </div>
              {shortlist.length === 0 ? (
                <div className="sl-empty">
                  <h3>♡</h3>
                  <p>
                    <span className="i-en">
                      No projects saved yet. Click ♡ on any project card to add
                      it here.
                    </span>
                    <span className="i-ru">
                      Шортлист пуст. Нажмите ♡ на карточке проекта, чтобы
                      добавить его сюда.
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          )}
          {tab === "services" && (
            <div className="tcontent content">
              <h2>{lang === "ru" ? "Проверка проекта: два отдельных этапа" : "Project review: two separate services"}</h2>
              <p>{lang === "ru" ? "Базовый обзор показывает источники, отмеченные проверки фактов и вопросы по недостающим документам. Он не присваивает инвестиционный рейтинг." : "The basic review shows sources, recorded fact reviews and open document questions. It does not assign an investment rating."}</p>
              <p>{lang === "ru" ? "Застройщик может обсудить проверку по методологии ClearView (vendor due diligence) за 49 000 THB. Налоги, состав работ, расходы третьих лиц и сроки согласуются до заказа. Оплата не гарантирует положительное заключение." : "Developers can discuss a ClearView review (vendor due diligence) for 49,000 THB. Taxes, scope, third-party costs and timing must be agreed before an order. Payment does not guarantee a favorable conclusion."}</p>
              <Link href="/services#developer">{lang === "ru" ? "Условия проверки (не заказ и не оплата)" : "Review scope (not an order or payment)"}</Link>
            </div>
          )}

          <footer className="ftr">
            <div className="ftr-top">
              <div>
                <div className="ftr-brand">Ignatev Estate Co., Ltd</div>
                <div className="ftr-addr">
                  115 Cherngtalay Office, Plaza Del Mar.1
                  <br />
                  116 Pasak-Koktanod Rd, Phuket 83000
                </div>
              </div>
              <div className="ftr-cta">
                <p>Contact</p>
                <strong>+66 92 240 7355</strong>
              </div>
            </div>
            <div className="ftr-portal">
              <Link href="/partner">
                <span className="i-en">Developer portal</span>
                <span className="i-ru">Кабинет застройщика</span>
              </Link>
              <Link href="/account">
                <span className="i-en">Account</span>
                <span className="i-ru">Аккаунт</span>
              </Link>
            </div>
            <div className="ftr-bot">
              For information purposes only. All investments require
              independent due diligence. Data sources cited per project card.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
