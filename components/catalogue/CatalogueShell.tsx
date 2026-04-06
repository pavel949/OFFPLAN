"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { toggleFavoriteLegacy } from "@/app/actions/favorites";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import type { CatalogMeta, CatalogProject } from "@/lib/types";
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

export function CatalogueShell({
  projects,
  meta,
  zones,
  htmlTabs,
  methodologyRu,
  methodologyEn,
}: {
  projects: CatalogProject[];
  meta: CatalogMeta;
  zones: string[];
  htmlTabs: {
    analytics: string;
    risk: string;
    devs: string;
    services: string;
    calcBenchmarks: string;
  };
  /** Из /admin/settings — блок над статичным HTML аналитики */
  methodologyRu?: string;
  methodologyEn?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<"en" | "ru">("en");
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
    const f = filtersFromSearchParams(searchParams);
    return f;
  }, [searchParams]);

  const setFilters = useCallback(
    (next: FilterState) => {
      const tabParam = searchParams.get("tab");
      const o = new URLSearchParams();
      if (tabParam) o.set("tab", tabParam);
      const fp = filtersToSearchParams(next);
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

  const filtered = useMemo(
    () => applyFilters(projects, filters),
    [projects, filters],
  );

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
    () => projects.filter((p) => shortlist.includes(p.id)),
    [projects, shortlist],
  );

  const cleanHtml = (html: string) =>
    html.replace(
      /<div id="tab-[^"]+" class="tcontent content hidden">/,
      '<div class="tcontent content">',
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
            <div className="hkpi-v">{meta.totalProjects}</div>
            <div className="hkpi-l">
              <span className="i-en">Projects</span>
              <span className="i-ru">Проектов</span>
            </div>
          </div>
          <div className="hkpi">
            <div className="hkpi-v">฿{meta.totalValueBnTHB}B</div>
            <div className="hkpi-l">
              <span className="i-en">2025 Launches</span>
              <span className="i-ru">Запусков 2025</span>
            </div>
          </div>
          <div className="hkpi">
            <div className="hkpi-v">~{meta.avgYieldPct}%</div>
            <div className="hkpi-l">
              <span className="i-en">Avg Yield</span>
              <span className="i-ru">Ср. доход</span>
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
                <option value="rating">Rating ↓</option>
                <option value="comp_asc">Completion — soonest</option>
                <option value="risk">Risk — safest first</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
                <option value="yield">Yield ↓</option>
                <option value="beach">Beach proximity</option>
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
                <span className="i-en">Risk Tier</span>
                <span className="i-ru">Уровень риска</span>
              </div>
              <select
                value={filters.fRisk}
                onChange={(e) => updateFilter("fRisk", e.target.value)}
              >
                <option value="">All levels</option>
                <option value="1">Tier 1 — Low</option>
                <option value="2">Tier 2 — Medium</option>
                <option value="3">Tier 3 — Higher</option>
              </select>
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
                <option value="">All segments</option>
                <option value="branded">Ultra-Luxury & Branded</option>
                <option value="condo">Investment Condo</option>
                <option value="villa-lux">Villa Luxury ฿30M+</option>
                <option value="villa-mid">Villa Premium ฿12–30M</option>
                <option value="villa-entry">Villa Entry ฿6–12M</option>
                <option value="completed">Completed 2024–25</option>
                <option value="offplan-new">New Off-Plan 2026–28</option>
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
                <option value="">All types</option>
                <option value="condo">Condominium</option>
                <option value="villa">Villa / Pool Villa</option>
                <option value="house">House / Townhouse</option>
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
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
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
                <option value="">Any status</option>
                <option value="ready">Ready / Inventory</option>
                <option value="building">Under construction</option>
                <option value="offplan">Off-plan / Pre-sale</option>
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
                <option value="">Any year</option>
                <option value="done24">Built 2024</option>
                <option value="done25">Built 2025</option>
                <option value="2026">Delivering 2026</option>
                <option value="2027">Delivering 2027</option>
                <option value="2028">2028+</option>
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
                <option value="">Any</option>
                <option value="bf">Beachfront</option>
                <option value="500">Under 500m</option>
                <option value="1k">Under 1km</option>
                <option value="inl">Inland</option>
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
                <option value="">Any</option>
                <option value="fh">Freehold condo</option>
                <option value="lh">Leasehold</option>
                <option value="both">Both</option>
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
                <option value="">Any</option>
                <option value="hotel">Hotel brand</option>
                <option value="pro">Professional</option>
                <option value="self">Self-managed</option>
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
                <option value="">Any</option>
                <option value="STR">STR</option>
                <option value="LTR">LTR</option>
                <option value="growth">Capital growth</option>
                <option value="lifestyle">Lifestyle</option>
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
                <option value="">All</option>
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
                Q2 2026 · Ignatev Estate ·{" "}
                <span className="i-en">Verified Data Only</span>
                <span className="i-ru">Только верифицированные данные</span>
              </p>
              <div className="hero-kpis">
                <div className="hkpi2">
                  <div className="hkpi2-v">{meta.totalProjects}</div>
                  <div className="hkpi2-l">
                    <span className="i-en">Verified projects</span>
                    <span className="i-ru">Проектов</span>
                  </div>
                </div>
                <div className="hkpi2">
                  <div className="hkpi2-v">{meta.buyCount}</div>
                  <div className="hkpi2-l">
                    BUY <span className="i-en">rated</span>
                    <span className="i-ru">рекомендаций</span>
                  </div>
                </div>
                <div className="hkpi2">
                  <div className="hkpi2-v">{meta.avoidCount}</div>
                  <div className="hkpi2-l">
                    AVOID <span className="i-en">flags</span>
                    <span className="i-ru">предупреждений</span>
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
                ["calc", "🧮 Calculator", "🧮 Калькулятор"],
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
                <span className="i-en">
                  ⚠️ Important: Recommendations are based on data current at time
                  of analysis. Prices, construction stage, developer terms and market
                  demand change continuously. Every project requires independent
                  verification and due diligence before any investment decision.
                </span>
                <span className="i-ru">
                  ⚠️ Важно: Рекомендации основаны на данных, актуальных на момент
                  анализа. Ситуация меняется — цены, стадия строительства, условия
                  застройщика и спрос. Перед инвестиционным решением каждый проект
                  требует самостоятельной проверки и due diligence.
                </span>
              </div>
              <div className="cgrid">
                {filtered.length === 0 ? (
                  <div className="no-res">
                    <h3>{lang === "ru" ? "Проекты не найдены" : "No projects found"}</h3>
                    <p>
                      <button type="button" className="btn-reset" onClick={resetFilters}>
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
              {(methodologyRu || methodologyEn) && (
                <div className="methodology-box">
                  <div className="methodology-hdr">
                    <span className="i-ru">Методология рейтинга (IE)</span>
                    <span className="i-en">Rating methodology (IE)</span>
                  </div>
                  {methodologyRu ? (
                    <p className="methodology-body i-ru">{methodologyRu}</p>
                  ) : null}
                  {methodologyEn ? (
                    <p className="methodology-body i-en">{methodologyEn}</p>
                  ) : null}
                </div>
              )}
              <div
                dangerouslySetInnerHTML={{ __html: cleanHtml(htmlTabs.analytics) }}
              />
            </div>
          )}
          {tab === "risk" && (
            <div
              className="tcontent content"
              dangerouslySetInnerHTML={{ __html: cleanHtml(htmlTabs.risk) }}
            />
          )}
          {tab === "devs" && (
            <div
              className="tcontent content"
              dangerouslySetInnerHTML={{ __html: cleanHtml(htmlTabs.devs) }}
            />
          )}
          {tab === "calc" && (
            <CalculatorPanel
              lang={lang}
              benchmarksHtml={htmlTabs.calcBenchmarks}
            />
          )}
          {tab === "shortlist" && (
            <div className="tcontent content">
              <div className="sh">
                <span className="i-en">♥ My Shortlist</span>
                <span className="i-ru">♥ Мой шортлист</span>
              </div>
              <p className="ss">
                <span className="i-en">
                  Projects saved to your shortlist. Stored locally in your browser.
                </span>
                <span className="i-ru">
                  Проекты, добавленные в шортлист. Хранятся в вашем браузере.
                </span>
              </p>
              <div className="sl-toolbar">
                <span className="sl-count">
                  {shortlist.length}{" "}
                  <span className="i-en">projects</span>
                  <span className="i-ru">проектов</span>
                </span>
                <button type="button" className="sl-clear" onClick={clearShortlist}>
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
                      No projects saved yet. Click ♡ on any project card to add it here.
                    </span>
                    <span className="i-ru">
                      Шортлист пуст. Нажмите ♡ на карточке проекта, чтобы добавить его сюда.
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          )}
          {tab === "services" && (
            <div
              className="tcontent content"
              dangerouslySetInnerHTML={{ __html: cleanHtml(htmlTabs.services) }}
            />
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
              <Link href="/admin">
                <span className="i-en">IE dashboard</span>
                <span className="i-ru">Панель IE · CRM</span>
              </Link>
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
              Q2 2026 · For information purposes only. All investments require
              independent due diligence. Data sources cited per project card.
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
