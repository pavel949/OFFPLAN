"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LeadModal } from "@/components/catalogue/LeadModal";
import { VerificationBadge } from "@/components/catalogue/VerificationBadge";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { localizeProject } from "@/lib/i18n/localize-project";
import { formatPrice, freshnessOf } from "@/lib/inventory/freshness";
import { zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";
import type {
  ProjectUnitRow,
  SalesCampaignRow,
  ProjectUpdateRow,
} from "@/lib/project-queries";
import { ProjectSubscribeBlock } from "./project-subscribe";
import "./project-detail.css";

const LANG_KEY = "phuket_lang";

const STATUS_LABEL: Record<string, { ru: string; en: string }> = {
  available: { ru: "Свободен", en: "Available" },
  reserved: { ru: "Бронь", en: "Reserved" },
  sold: { ru: "Продан", en: "Sold" },
};

export function ProjectDetailClient({
  project,
  extras,
  backHref,
  legacyId,
}: {
  project: CatalogProject;
  extras: {
    catalogProjectId: string | null;
    units: ProjectUnitRow[];
    campaigns: SalesCampaignRow[];
    updates: ProjectUpdateRow[];
    lat: number | null;
    lng: number | null;
    dataConfirmedAt: string | null;
  };
  backHref: string;
  legacyId: number;
}) {
  const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    const l = localStorage.getItem(LANG_KEY);
    if (l === "ru" || l === "en") setLang(l);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const p = useMemo(() => localizeProject(project, lang), [project, lang]);

  useEffect(() => {
    const id = extras.catalogProjectId;
    if (!id) return;
    void fetch("/api/analytics/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "project.view",
        project_id: id,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      }),
    }).catch(() => {});
  }, [extras.catalogProjectId]);

  const ru = lang === "ru";
  const showRec = process.env.NEXT_PUBLIC_SHOW_PROJECT_REC === "true";
  const mapHref =
    extras.lat != null && extras.lng != null
      ? `https://www.google.com/maps?q=${extras.lat},${extras.lng}`
      : null;

  return (
    <div className="pd-wrap" data-lang={lang}>
      <LeadModal
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        lang={lang}
        projectId={p.id}
        projectName={p.n}
      />
      <header className="pd-hdr">
        <Link href={backHref} className="pd-back">
          {ru ? "← К каталогу" : "← Back to catalogue"}
        </Link>
        <div className="pd-actions">
          <button type="button" className="pd-lang" onClick={() => {
              const n = ru ? "en" : "ru";
              setLang(n);
              localStorage.setItem(LANG_KEY, n);
            }}>
            {ru ? "🇬🇧 ENG" : "🇷🇺 РУС"}
          </button>
          <button type="button" className="pd-cta" onClick={() => setLeadOpen(true)}>
            <span className="i-en">✉ Inquiry</span>
            <span className="i-ru">✉ Заявка</span>
          </button>
        </div>
      </header>

      <div className="pd-hero">
        <div className="pd-gallery">
          <div className="pd-ph" aria-hidden />
          <div className="pd-ph" aria-hidden />
          <div className="pd-ph" aria-hidden />
        </div>
        <p className="pd-gallery-note">
          <span className="i-en">Gallery: partner uploads after moderation.</span>
          <span className="i-ru">Галерея: загрузки партнёра после модерации.</span>
        </p>
      </div>

      <div className="pd-main">
        <h1 className="pd-title">{p.n}</h1>
        <p style={{ margin: "4px 0 8px" }}>
          <VerificationBadge ver={p.ver} lang={lang} />
        </p>
        <p className="pd-dev">{p.dev}</p>

        {extras.campaigns.length > 0 ? (
          <div className="pd-campaigns">
            {extras.campaigns.map((c) => (
              <span key={c.id} className="pd-camp">
                {ru ? c.label_ru || c.label_en : c.label_en}
              </span>
            ))}
          </div>
        ) : null}

        {extras.dataConfirmedAt ? (
          <p className="pd-fresh text-xs text-[var(--muted)] mb-4">
            {ru
              ? `Данные подтверждены застройщиком: ${new Date(extras.dataConfirmedAt).toLocaleString("ru-RU")}`
              : `Developer data confirmed: ${new Date(extras.dataConfirmedAt).toLocaleString("en-GB")}`}
          </p>
        ) : (
          <p className="pd-fresh text-xs text-[var(--amb)] mb-4">
            {ru
              ? "Дата подтверждения инвентаря застройщиком пока не указана."
              : "Inventory confirmation date not set by developer yet."}
          </p>
        )}

        {extras.catalogProjectId ? (
          <section className="pd-card mb-4">
            <h2 className="pd-h2">
              <span className="i-en">Stay informed</span>
              <span className="i-ru">Уведомления</span>
            </h2>
            <ProjectSubscribeBlock
              legacyId={legacyId}
              catalogProjectId={extras.catalogProjectId}
              lang={lang}
            />
          </section>
        ) : null}

        <div className="pd-grid">
          <section className="pd-card">
            <h2 className="pd-h2">
              <span className="i-en">Summary</span>
              <span className="i-ru">Кратко</span>
            </h2>
            <p className="pd-desc">{p.desc}</p>
            {showRec ? (
              <div className={`pd-rec rec-${p.rec}`}>
                <strong>{p.rec}</strong> — {p.recText}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)] mt-2">
                {ru
                  ? "Публичные «рекомендации» отключены (модель маркетплейса / застройщик)."
                  : "Public buy/watch/avoid labels are off (marketplace governance)."}
              </p>
            )}
          </section>

          <section className="pd-card">
            <h2 className="pd-h2">
              <span className="i-en">Location</span>
              <span className="i-ru">Локация</span>
            </h2>
            {mapHref ? (
              <a href={mapHref} target="_blank" rel="noopener noreferrer" className="pd-maplink">
                {ru ? "Открыть на карте" : "Open in Google Maps"} →
              </a>
            ) : (
              <p className="pd-muted">
                <span className="i-en">Coordinates will appear after partner confirms.</span>
                <span className="i-ru">Координаты появятся после подтверждения партнёром.</span>
              </p>
            )}
            <p className="pd-zone">{zoneLabel(p.zone, lang)}</p>
          </section>
        </div>

        <section className="pd-card pd-units">
          <h2 className="pd-h2">
            <span className="i-en">Units & pricing</span>
            <span className="i-ru">Юниты и цены</span>
          </h2>
          {extras.units.length > 0 ? (
            <div className="pd-table-wrap">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>{ru ? "Лот" : "Unit"}</th>
                    <th>{ru ? "Спальни" : "Bedrooms"}</th>
                    <th>{ru ? "Площадь, м²" : "Area, sqm"}</th>
                    <th>{ru ? "Цена" : "Price"}</th>
                    <th>{ru ? "Статус" : "Status"}</th>
                    <th>{ru ? "Обновлено" : "Updated"}</th>
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
                        <td title={f === "stale" && !sold ? (ru ? "Цена давно не обновлялась" : "Price not refreshed recently") : undefined}>
                          {sold
                            ? "—"
                            : hidden
                              ? ru
                                ? "уточняйте у застройщика"
                                : "ask the developer"
                              : `${formatPrice(u.price_thb, u.currency ?? "THB", lang)}${f === "stale" ? " ⚠" : ""}`}
                        </td>
                        <td>{STATUS_LABEL[u.status]?.[lang] ?? u.status}</td>
                        <td>
                          {u.price_updated_at
                            ? new Date(u.price_updated_at).toLocaleDateString(ru ? "ru-RU" : "en-GB")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pd-muted">
              {ru ? "Сводка по юнитам: " : "Unit mix: "}
              <strong>{p.units || "—"}</strong>
              {p.unitSzM2 ? ` · ${p.unitSzM2}` : ""}
            </p>
          )}
        </section>

        {extras.updates.length > 0 ? (
          <section className="pd-card pd-updates">
            <h2 className="pd-h2">
              <span className="i-en">Project updates</span>
              <span className="i-ru">Новости и стройка</span>
            </h2>
            <ul className="pd-update-list space-y-4">
              {extras.updates.map((u) => (
                <li key={u.id} className="border-b border-[var(--bdr)] pb-3">
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(u.published_at).toLocaleDateString(ru ? "ru-RU" : "en-GB")} · {u.kind}
                  </p>
                  <p className="font-medium">{ru ? u.title_ru || u.title_en : u.title_en || u.title_ru}</p>
                  {(ru ? u.body_ru : u.body_en) || (ru ? u.body_en : u.body_ru) ? (
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ru ? u.body_ru || u.body_en : u.body_en || u.body_ru}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
