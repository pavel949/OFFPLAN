"use client";

import { completionLabel, ownershipLabel } from "@/lib/buyer-display";
import { displayDate as fmtDate } from "@/lib/display-date";
import { LOCATION_PRECISION } from "@/lib/project-location";
import { usePublicationExpired } from "./usePublicationExpired";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LeadModal } from "@/components/catalogue/LeadModal";
import { SalesOffers } from "@/components/catalogue/SalesOffers";
import type { PublicSales } from "@/lib/sales-public";
import { Scene } from "@/components/ie/Scene";
import { ProjectSubscribeBlock } from "@/app/project/[slug]/project-subscribe";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { localizeProject } from "@/lib/i18n/localize-project";
import { formatPrice, freshnessOf } from "@/lib/inventory/freshness";
import { operatingCostTotals } from "@/lib/project-evidence";
import type { PublicProjectFacts } from "@/lib/project-facts-query";
import type { ProjectUnitRow, ProjectUpdateRow, SalesCampaignRow } from "@/lib/project-queries";
import { effectiveLevel, LEVEL_TEXT } from "@/lib/registry/levels";
import { locationSlug, projectSlug } from "@/lib/slug";
import {
  SOURCE_KIND_LABEL_EN,
  SOURCE_KIND_LABEL_RU,
  sourceFreshness,
  sourceHost,
} from "@/lib/sources";
import { taxLabel, zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";

const LANG_KEY = "phuket_lang";

const SALES_STAGE: Record<string, { ru: string; en: string }> = {
  prelaunch: { ru: "До старта продаж", en: "Pre-launch" },
  launch: { ru: "Старт продаж", en: "Launch" },
  selling: { ru: "Продажи идут", en: "Selling" },
  last_units: { ru: "Последние лоты", en: "Last units" },
  sold_out: { ru: "Продано", en: "Sold out" },
};
const UNIT_STATUS: Record<string, { ru: string; en: string }> = {
  unknown: {ru:"Уточняется",en:"To be confirmed"},
  available: { ru: "Свободен", en: "Available" },
  reserved: { ru: "Бронь", en: "Reserved" },
  sold: { ru: "Продан", en: "Sold" },
};
const STEPS = [
  { key: "offplan", ru: "Старт продаж", en: "Launch" },
  { key: "building", ru: "Строительство", en: "Construction" },
  { key: "ready", ru: "Сдача", en: "Handover" },
] as const;

export type ProjectPageProps = {
  sales?: PublicSales | null;
  project: CatalogProject;
  facts: PublicProjectFacts;
  extras: {
    catalogProjectId: string | null;
    units: ProjectUnitRow[];
    campaigns: SalesCampaignRow[];
    updates: ProjectUpdateRow[];
    lat: number | null;
    lng: number | null;
    dataConfirmedAt: string | null;
  };
  developer: { slug: string; name: string; website: string | null };
  legacyId: number;
};

export function ProjectPage({ project, facts, extras, developer, legacyId,sales:initialSales }: ProjectPageProps) {
  const expired = usePublicationExpired(initialSales?.expiresAt);
  const unitSales = expired && initialSales ? { ...initialSales, offers: [] } : initialSales;
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [leadOpen, setLeadOpen] = useState(false);
  const [light, setLight] = useState<number | null>(null);
  const [sqm, setSqm] = useState("");

  useEffect(() => {
    const l = localStorage.getItem(LANG_KEY);
    if (l === "ru" || l === "en") setLang(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);
  useEffect(() => {
    const id = extras.catalogProjectId;
    if (!id) return;
    void fetch("/api/analytics/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "project.view", project_id: id, path: window.location.pathname }),
    }).catch(() => {});
  }, [extras.catalogProjectId]);
  useEffect(() => {
    if (light == null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(".ie-lb-x")?.focus());
    const on = (e: KeyboardEvent) => {
      if(e.key === "Escape")setLight(null);
      if(e.key === "Tab") {
        const controls=[...document.querySelectorAll<HTMLElement>(".ie-lightbox button,.ie-lightbox a[href]")];
        if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}
        else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}
      }
    };
    window.addEventListener("keydown", on);
    return () => {cancelAnimationFrame(frame);document.body.style.overflow=overflow;window.removeEventListener("keydown", on);previous?.focus();};
  }, [light]);

  const ru = lang === "ru";
  const t = (a: string, b: string) => (ru ? a : b);
  const p = useMemo(() => localizeProject(project, lang), [project, lang]);

  const photos = facts.facts.filter((f) => f.kind === "photo");
  const amenities = facts.facts.filter((f) => f.kind === "amenity");
  const costs = facts.facts.filter((f) => f.kind === "operating_cost");
  const sales = facts.facts.find((f) => f.kind === "sales");
  const totals = operatingCostTotals(costs, sqm.trim() ? Number(sqm) : null);
  const level = effectiveLevel(p.ver);
  const stepIdx = STEPS.findIndex((s) => s.key === p.stK);
  const site = facts.sources.find((s) => s.kind === "website");
  const otherMaterials = facts.sources.filter((s) => s.kind !== "website");
  const devSite = developer.website && /^https:\/\//.test(developer.website) ? developer.website : null;
  const mapHref = p.location && p.location.precision !== "sales_office" ? `https://www.google.com/maps?q=${p.location.lat},${p.location.lng}` : null;
  const inv = facts.inventory;
  const publishedCurrencies = new Set(unitSales?.offers.map(o=>o.currency));
  const displayPrice = unitSales ? unitSales.offers.length && publishedCurrencies.size===1 ? formatPrice(Math.min(...unitSales.offers.map(o=>o.price)),unitSales.offers[0].currency,lang) : t("Уточняется по юниту","Ask for unit pricing") : p.pT;
  const showRec = process.env.NEXT_PUBLIC_SHOW_PROJECT_REC === "true";
  const kindSeed = p.type === "condo" ? "condo" : p.type === "house" ? "house" : "villa";
  const heroPhoto = photos.find(f=>f.details.cover===true) ?? photos[0];
  const salesStageLabel = sales ? SALES_STAGE[String(sales.details.stage)]?.[lang] : null;

  const publishedOwnerships = [...new Set(unitSales?.offers.map(o=>o.ownership) ?? [])];
  const completion = completionLabel(p.compQ || p.compY,lang);
  const facts6: [string, string][] = [
    [t("Район", "Area"), zoneLabel(p.zone, lang)],
    [t("Тип", "Type"), taxLabel("type", p.type, lang)],
    [t("Сегмент", "Segment"), taxLabel("seg", p.seg, lang, true)],
    [t("Владение", "Ownership"), publishedOwnerships.length ? publishedOwnerships.map(v=>ownershipLabel(v,lang)).join(" / ") + t(" · по предложениям ниже"," · see unit offers") : unitSales ? t("Уточняется по юниту","Confirm per unit") : taxLabel("own", p.own, lang)],
    [t("Управление", "Management"), taxLabel("mgmt", p.mgmt, lang)],
    [t("До пляжа", "To beach"), taxLabel("beach", p.beach, lang)],
    [t("Фокус", "Focus"), taxLabel("focus", p.focus, lang)],
    [t("Лотов в проекте", "Units"), p.units || "—"],
    [t("Размеры, м²", "Sizes, sqm"), p.unitSzM2 || "—"],
    [t("Цена за м²", "Price per sqm"), p.sqmP || "—"],
    [t("Спальни", "Bedrooms"), p.minBR == null ? t("Уточняется", "Not confirmed") : p.minBR === 0 ? t("от студии", "from studio") : t(`от ${p.minBR}`, `from ${p.minBR}`)],
  ];

  return (
    <div className="ie-page" data-lang={lang}>
      <LeadModal open={leadOpen} onClose={() => setLeadOpen(false)} lang={lang} projectId={p.id} projectName={p.n} />

      {/* HERO */}
      <section className="ie-phero">
        <div className="ie-phero-bg">
          {heroPhoto ? (
            <Image src={String(heroPhoto.details.url)} alt={String(heroPhoto.details.caption ?? p.n)} fill priority sizes="100vw" unoptimized referrerPolicy="no-referrer" />
          ) : (
            <Scene seed={p.id} kind={kindSeed} />
          )}
        </div>
        <div className="ie-phero-shade" />
        <div className="ie-wrap ie-phero-in">
          <div className="ie-crumbs">
            <Link href="/">{t("Каталог", "Catalogue")}</Link> / <Link href={`/developers/${developer.slug}`}>{developer.name}</Link>
          </div>
          <div className="ie-badges-row">
            <span className="ie-badge">{(STEPS[stepIdx]?.[lang] ?? t("Стадия не подтверждена", "Stage not confirmed"))}</span>
            {salesStageLabel ? <span className="ie-badge">{salesStageLabel}</span> : null}
            {extras.campaigns.length ? <span className="ie-badge ie-badge--gold">{t("Акция", "Promo")}</span> : null}
            <span className={`ie-badge ${level > 0 ? "ie-badge--ver" : ""}`}>
              {level > 0 ? "🛡 " : ""}
              {LEVEL_TEXT[level][ru ? "ruShort" : "enShort"]}
            </span>
          </div>
          <h1 className="ie-ptitle">{p.n}</h1>
          <p className="ie-psub">
            {t("Застройщик", "Developer")}: <Link href={`/developers/${developer.slug}`}>{p.dev}</Link> · <Link href={`/locations/${locationSlug(p.zone)}`}>{zoneLabel(p.zone, lang)}</Link> · {taxLabel("type", p.type, lang)}
          </p>
          <div className="ie-phero-row">
            <div className="ie-pprice">
              <small>{t("Цена от", "From")}</small>
              <b>{displayPrice}</b>
              <span>
                {t("Сдача", "Handover")}: {completion}
              </span>
            </div>
            <div className="ie-pcta">
              <button type="button" className="ie-btn ie-btn--gold" onClick={() => setLeadOpen(true)}>
                {t("Задать вопрос по проекту", "Ask about the project")}
              </button>
              {site ? (
                <a className="ie-btn ie-btn--ghost" href={site.url} target="_blank" rel="noopener noreferrer nofollow">
                  {t("Сайт проекта", "Project website")} ↗
                </a>
              ) : devSite ? (
                <a className="ie-btn ie-btn--ghost" href={devSite} target="_blank" rel="noopener noreferrer nofollow">
                  {t("Сайт застройщика", "Developer website")} ↗
                </a>
              ) : null}
              <button type="button" className="ie-btn ie-btn--ghost" onClick={() => { const n = ru ? "en" : "ru"; setLang(n); localStorage.setItem(LANG_KEY, n); }}>
                {ru ? "EN" : "RU"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="ie-wrap ie-pgrid">
        <main className="ie-pmain">
          {/* OVERVIEW */}
          <section className="ie-card">
            <h2 className="ie-h2">{t("О проекте", "Overview")}</h2>
            <p className="ie-lead">{p.desc}</p>
            {showRec ? <div className="ie-note"><b>{p.rec}</b>: {p.recText}</div> : null}
            <dl className="ie-dl">
              {facts6.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="ie-small">
              {extras.dataConfirmedAt
                ? t(`Данные подтверждены застройщиком: ${fmtDate(extras.dataConfirmedAt, true)}.`, `Developer confirmed the data on ${fmtDate(extras.dataConfirmedAt, false)}.`)
                : t("Дата подтверждения данных застройщиком пока не указана.", "The developer has not yet confirmed the data date.")}{" "}
              {LEVEL_TEXT[level][ru ? "ruHint" : "enHint"]}
            </p>
          </section>

          <nav className="ie-project-jump" aria-label={t("Разделы проекта","Project sections")}>{unitSales?.offers.length ? <a className="ie-btn ie-btn--gold" href="#unit-offers">{t("Выбрать из опубликованных юнитов","Choose a published unit")}</a> : null}<a href="#project-photos">{t("Фото и визуализации","Photos and renders")}</a><a href="#project-materials">{t("Документы и источники","Documents and sources")}</a></nav>
          {/* TIMELINE */}
          <section className="ie-card">
            <h2 className="ie-h2">{t("Этапы проекта", "Project stages")}</h2>
            <ol className="ie-steps" aria-label={t("Этапы проекта", "Project stages")}>
              {STEPS.map((s, i) => (
                <li key={s.key} className={i < stepIdx || (i === 2 && stepIdx === 2) ? "is-done" : i === stepIdx ? "is-now" : ""}>
                  <span className="ie-step-dot" />
                  <b>{s[lang]}</b>
                  <small>
                    {i === 0 ? (salesStageLabel ?? t("статус продаж не подтверждён", "sales status unconfirmed")) : i === 1 ? (p.stT || "") : stepIdx < 0 ? completion : `${stepIdx === 2 ? t("сдан", "completed") : t("ожидается", "expected")}: ${completion}`}
                  </small>
                </li>
              ))}
            </ol>
            {sales ? (
              <p className="ie-small">
                {t("Стадия продаж", "Sales stage")}: {salesStageLabel}
                {typeof sales.details.starts_at === "string" ? ` · ${sales.details.starts_at}` : ""} ·{" "}
                <a href={sales.source_url} target="_blank" rel="noopener noreferrer nofollow">{t("источник", "source")}</a> · {fmtDate(sales.observed_at, ru)}
              </p>
            ) : null}
          </section>

          {/* PHOTOS */}
          <section className="ie-card">
            <h2 className="ie-h2" id="project-photos">{t("Фото и визуализации проекта", "Project photos and renders")}</h2>
            <p className="ie-small">{t("Визуализации показывают замысел проекта и не подтверждают готовность. Дата материала или наблюдения указана отдельно от даты съёмки.","Renders illustrate the design and do not establish construction progress. Material observation dates are separate from capture dates.")}</p>
            {photos.length ? (
              <div className="ie-gallery">
                {photos.map((f, i) => (
                  <button key={f.id} type="button" className="ie-shot" onClick={() => setLight(i)} aria-label={String(f.details.caption ?? f.title)}>
                    <Image src={String(f.details.url)} alt={String(f.details.caption ?? "")} fill sizes="(max-width: 700px) 50vw, 300px" unoptimized referrerPolicy="no-referrer" />
                    <span>{t("Источник просмотрен ","Source observed ")}{fmtDate(f.observed_at, ru)}{f.details.render ? ` · ${t("визуализация", "render")}` : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ie-empty-card">
                <div className="ie-empty-scene"><Scene seed={p.id + 1} kind={kindSeed} /></div>
                <p>{t("Материалы ещё не добавлены в эту карточку. Это не означает, что у застройщика их нет.", "Materials have not been added to this card yet. This does not mean the developer has none.")}</p>
              </div>
            )}
          </section>

          {/* PROMOS */}
          {extras.campaigns.length ? (
            <section className="ie-card">
              <h2 className="ie-h2">{t("Акции и предложения", "Promotions")}</h2>
              <div className="ie-promos">
                {extras.campaigns.map((c) => (
                  <div key={c.id} className="ie-promo">
                    <b>{ru ? c.label_ru || c.label_en : c.label_en || c.label_ru}</b>
                    <small>{c.ends_at ? `${t("до", "until")} ${fmtDate(c.ends_at, ru)}` : t("действует сейчас", "active now")}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* UNITS */}
          {unitSales ? <SalesOffers sales={unitSales} projectId={p.id} projectName={p.n} lang={lang} /> : <section className="ie-card">
            <h2 className="ie-h2">{t("Лоты и цены", "Units and prices")}</h2>
            {extras.units.length ? (
              <div className="ie-table-wrap">
                <table className="ie-table">
                  <thead>
                    <tr>
                      <th>{t("Лот", "Unit")}</th><th>{t("Спальни", "Bed")}</th><th>{t("м²", "sqm")}</th><th>{t("Цена", "Price")}</th><th>{t("Статус", "Status")}</th><th>{t("Обновлено", "Updated")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extras.units.map((u) => {
                      const f = freshnessOf(u.price_updated_at);
                      const sold = u.status === "sold";
                      const hidden = !sold && f === "expired";
                      return (
                        <tr key={u.id}>
                          <td>{u.label}</td>
                          <td>{u.bedrooms ?? "—"}</td>
                          <td>{u.sqm ?? "—"}</td>
                          <td>{sold ? "—" : hidden ? t("уточняйте у застройщика", "ask the developer") : `${formatPrice(u.price_thb, u.currency ?? "THB", lang)}${f === "stale" ? " ⚠" : ""}`}</td>
                          <td><span className={`ie-st ie-st--${u.status}`}>{UNIT_STATUS[u.status]?.[lang] ?? u.status}</span></td>
                          <td>{u.price_updated_at ? new Date(u.price_updated_at).toLocaleDateString(ru ? "ru-RU" : "en-GB") : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ie-small">
                {t("Подробный прайс-лист застройщик ещё не внёс. Сводка:", "No detailed price list yet. Summary:")} <b>{p.units || "—"}</b>
                {p.unitSzM2 ? ` · ${p.unitSzM2}` : ""}
              </p>
            )}
            {inv ? (
              <p className="ie-small">
                {t("Внесено лотов", "Recorded units")}: {inv.recorded} · {t("свободно", "available")} {inv.available} · {t("бронь", "reserved")} {inv.reserved} · {t("продано", "sold")} {inv.sold}.{" "}
                {t("Это только внесённые в систему лоты, а не весь объём проекта.", "Counts cover recorded units only, not necessarily the entire project.")}
              </p>
            ) : (
              <p className="ie-small">{t("Актуальные остатки не подтверждены. Исторические прайсы не используются как текущее наличие.", "Current availability is not confirmed. Historical price lists are not treated as current inventory.")}</p>
            )}
          </section>

          }
          {/* NEWS */}
          {extras.updates.length ? (
            <section className="ie-card">
              <h2 className="ie-h2">{t("Новости проекта", "Project news")}</h2>
              <ul className="ie-feed">
                {extras.updates.map((u) => (
                  <li key={u.id}>
                    <time dateTime={u.published_at}>{fmtDate(u.published_at, ru)}</time>
                    <b>{ru ? u.title_ru || u.title_en : u.title_en || u.title_ru}</b>
                    {(ru ? u.body_ru || u.body_en : u.body_en || u.body_ru) ? <p>{ru ? u.body_ru || u.body_en : u.body_en || u.body_ru}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* MATERIALS */}
          <section className="ie-card">
            <h2 className="ie-h2" id="project-materials">{t("Материалы застройщика", "Developer materials")}</h2>
            {site || otherMaterials.length || devSite ? (
              <ul className="ie-links">
                {[...(site ? [site] : []), ...otherMaterials].map((s) => {
                  const fr = sourceFreshness(s.cadence, s.confirmed_at);
                  return (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                        <b>{(ru ? SOURCE_KIND_LABEL_RU : SOURCE_KIND_LABEL_EN)[s.kind]}</b>
                        <span>{s.title} · {sourceHost(s.url)}</span>
                      </a>
                      <small>{s.confirmed_at ? `${t("подтверждено", "confirmed")} ${fmtDate(s.confirmed_at, ru)}${fr === "stale" ? t(" (давно)", " (stale)") : ""}` : ""}</small>
                    </li>
                  );
                })}
                {devSite ? (
                  <li>
                    <a href={devSite} target="_blank" rel="noopener noreferrer nofollow">
                      <b>{t("Сайт застройщика", "Developer website")}</b>
                      <span>{sourceHost(devSite)}</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="ie-small">{t("Застройщик ещё не добавил ссылки на брошюру, рендеры и документы.", "The developer has not added brochure, renders or document links yet.")}</p>
            )}
            <p className="ie-small">{t("Материалы хранятся у застройщика и не проверяются IE.", "Materials are hosted by the developer and are not verified by IE.")}</p>
          </section>

          {/* AMENITIES + COSTS */}
          <section className="ie-card">
            <h2 className="ie-h2">{t("Инфраструктура и расходы владения", "Amenities and ownership costs")}</h2>
            {amenities.length ? (
              <ul className="ie-bul">
                {amenities.map((f) => (
                  <li key={f.id}><b>{f.title}</b>: {String(f.details.description ?? "")} <a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow">{t("источник", "source")}</a></li>
                ))}
              </ul>
            ) : (
              <p className="ie-small">{t("Подтверждённая спецификация пока не предоставлена.", "A confirmed specification has not been supplied.")}</p>
            )}
            {unitSales ? <p className="ie-small"><a href="#unit-offers">{t("Расходы и график оплаты указаны в условиях выбранного юнита выше.","Costs and payment schedules are shown with the selected unit above.")}</a></p> : costs.length ? (
              <>
                <label className="ie-field">
                  {t("Площадь выбранного лота, м²", "Selected unit area, sqm")}
                  <input type="number" min="0.01" step="0.01" value={sqm} onChange={(e) => setSqm(e.target.value)} />
                </label>
                <ul className="ie-bul">
                  {costs.map((f) => (
                    <li key={f.id}>{f.title}: {Number(f.details.amount).toLocaleString()} {String(f.details.currency)} / {String(f.details.basis)} / {String(f.details.period)} <a href={f.source_url} target="_blank" rel="noopener noreferrer nofollow">{t("источник", "source")}</a></li>
                  ))}
                </ul>
                {totals.map((x) => (
                  <p key={x.currency} className="ie-small">
                    {x.needsArea ? t("Для расчёта укажите площадь.", "Enter an area to calculate.") : `${t("Известные расходы в год", "Known annual costs")}: ${x.annual.toLocaleString()} ${x.currency} · ${t("разовые", "one-off")}: ${x.once.toLocaleString()} ${x.currency}`}
                  </p>
                ))}
                <p className="ie-small">{t("Сумма включает только подтверждённые статьи; электричество, вода, налоги и страхование в неё не входят.", "Totals include confirmed items only; utilities, taxes and insurance are excluded.")}</p>
              </>
            ) : (
              <p className="ie-small">{t("Тарифы эксплуатации не предоставлены. Нулевые расходы не предполагаются.", "Operating rates have not been supplied. Costs are unknown, not zero.")}</p>
            )}
          </section>

          {/* DEVELOPER */}
          <section className="ie-card">
            <h2 className="ie-h2">{t("Застройщик", "Developer")}</h2>
            <p className="ie-lead">
              <Link href={`/developers/${developer.slug}`} className="ie-ulink">{developer.name}</Link>{" "}
              {facts.developerProjects.length ? t("— и ещё проекты:", "— and other projects:") : ""}
            </p>
            {facts.developerProjects.length ? (
              <ul className="ie-bul">
                {facts.developerProjects.map((x) => (
                  <li key={x.legacy_id}>
                    <Link href={`/project/${projectSlug({ n: x.payload.n, id: x.legacy_id })}`} className="ie-ulink">{x.payload.n}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link className="ie-btn ie-btn--ink" href={`/developers/${developer.slug}`}>{t("Открыть досье застройщика", "Open developer dossier")}</Link>
          </section>
        </main>

        <aside className="ie-paside">
          <div className="ie-sticky">
            <div className="ie-card ie-pbox">
              <small>{t("Цена от", "From")}</small>
              <b>{displayPrice}</b>
              <ul>
                <li><span>{t("Сдача", "Handover")}</span><i>{completion}</i></li>
                <li><span>{t("Стадия", "Stage")}</span><i>{(STEPS[stepIdx]?.[lang] ?? t("Стадия не подтверждена", "Stage not confirmed"))}</i></li>
                <li><span>{t("В продаже", "On sale")}</span><i>{unitSales?.offers.length ? `${new Set(unitSales.offers.map(o=>o.unitId)).size} ${t("лот. в прайсе","units in price list")}` : t("уточняется", "unconfirmed")}</i></li>
                <li><span>{t("Проверка", "Verification")}</span><i>L{level}</i></li>
              </ul>
              <button type="button" className="ie-btn ie-btn--gold" style={{ width: "100%", justifyContent: "center" }} onClick={() => setLeadOpen(true)}>
                {t("Получить прайс и условия", "Get price list & terms")}
              </button>
              <Link className="ie-btn ie-btn--line" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} href={`/?view=map&q=${encodeURIComponent(p.n)}`} prefetch={false}>{t("На карте OFFPLAN", "OFFPLAN map")} →</Link>
              {p.location ? <p className="ie-small">{LOCATION_PRECISION[p.location.precision]} · {p.location.observedOn}<br/><a href={p.location.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{p.location.sourceTitle}</a><br/>{p.location.note}<br/>{p.location.licenseNote}{p.location.reuseBasis === "open_data" && new URL(p.location.sourceUrl).hostname === "www.openstreetmap.org" ? <> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a></> : null}</p> : <p className="ie-small">{t("Точное расположение пока не подтверждено. Район в карточке не заменяет адрес проекта.","Exact location is not confirmed. The catalogue area is not a project address.")}</p>}
              {mapHref ? <a className="ie-btn ie-btn--line" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} href={mapHref} target="_blank" rel="noopener noreferrer">{t("Внешняя карта", "External map")} ↗</a> : null}
            </div>
            <div className="ie-help">
              {t("Вопрос по сделке или конфликт с застройщиком (просрочка, возврат денег)?", "A question about the deal or a dispute with the developer?")}{" "}
              <Link href="/protection/contact">{t("Обратитесь к нам", "Contact us")}</Link>
              {" · "}
              <Link href="/protection">{t("Защита прав инвесторов", "Investor protection")}</Link>
            </div>
            {extras.catalogProjectId ? (
              <div className="ie-card ie-pbox">
                <h3 className="ie-h3">{t("Следить за проектом", "Follow this project")}</h3>
                <ProjectSubscribeBlock legacyId={legacyId} catalogProjectId={extras.catalogProjectId} lang={lang} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {light != null && photos[light] ? (
        <div className="ie-lightbox" role="dialog" aria-modal="true" aria-labelledby="project-photo-caption" onClick={() => setLight(null)}>
          <button type="button" className="ie-lb-x" aria-label={t("Закрыть", "Close")}>✕</button>
          <figure onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={String(photos[light].details.url)} alt={String(photos[light].details.caption ?? "")} referrerPolicy="no-referrer" />
            <figcaption id="project-photo-caption">
              {String(photos[light].details.caption ?? photos[light].title)} · {t("наблюдение источника ","source observed ")}{fmtDate(photos[light].observed_at, ru)} ·{" "}
              <a href={photos[light].source_url} target="_blank" rel="noopener noreferrer nofollow">{t("источник", "source")}</a>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
