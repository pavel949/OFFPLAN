"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { projectSlug } from "@/lib/slug";
import type { CatalogProject } from "@/lib/types";

const SC: Record<string, string> = {
  branded: "s-branded",
  condo: "s-condo",
  "villa-lux": "s-villa-lux",
  "villa-mid": "s-villa-mid",
  "villa-entry": "s-villa-entry",
  completed: "s-completed",
  "offplan-new": "s-offplan-new",
};

const RISK_EMOJI: Record<number, string> = { 1: "🟢", 2: "🟡", 3: "🔴" };
const RISK_EN: Record<number, string> = {
  1: "Tier 1 Low",
  2: "Tier 2 Medium",
  3: "Tier 3 Higher",
};
const RISK_RU: Record<number, string> = {
  1: "Уровень 1 Низкий",
  2: "Уровень 2 Средний",
  3: "Уровень 3 Высокий",
};
const RISK_CLS: Record<number, string> = { 1: "r1", 2: "r2", 3: "r3" };

const SEG_EN: Record<string, string> = {
  branded: "Ultra-Lux & Branded",
  condo: "Investment Condo",
  "villa-lux": "Villa Luxury",
  "villa-mid": "Villa Premium",
  "villa-entry": "Villa Entry",
  completed: "Completed 2024–25",
  "offplan-new": "New Off-Plan",
};
const SEG_RU: Record<string, string> = {
  branded: "Ультра-Люкс",
  condo: "Инвест. кондо",
  "villa-lux": "Вилла Люкс",
  "villa-mid": "Вилла Премиум",
  "villa-entry": "Вилла Вход",
  completed: "Завершённые 2024–25",
  "offplan-new": "Новые оффплан",
};

const BEACH_EN: Record<string, string> = {
  bf: "Beachfront",
  "500": "<500m",
  "1k": "<1km",
  inl: "Inland",
};
const BEACH_RU: Record<string, string> = {
  bf: "Первая линия",
  "500": "<500м",
  "1k": "<1км",
  inl: "В глубине",
};

const OWN_EN: Record<string, string> = {
  fh: "Freehold",
  lh: "Leasehold",
  both: "FH+LH",
};
const OWN_RU: Record<string, string> = {
  fh: "Фрихолд",
  lh: "Лизхолд",
  both: "ФХ+ЛХ",
};

const MGMT_EN: Record<string, string> = {
  hotel: "🏨 Hotel brand",
  pro: "👥 Professional",
  self: "Self-managed",
};
const MGMT_RU: Record<string, string> = {
  hotel: "🏨 Гостинич. бренд",
  pro: "👥 Профессиональное",
  self: "Самоуправл.",
};

const FOCUS_EN: Record<string, string> = {
  STR: "STR",
  LTR: "LTR",
  growth: "Growth",
  lifestyle: "Lifestyle",
  mixed: "Mixed",
};
const FOCUS_RU: Record<string, string> = {
  STR: "STR",
  LTR: "LTR",
  growth: "Рост",
  lifestyle: "Lifestyle",
  mixed: "Смешан.",
};

const REC_EN: Record<string, string> = {
  BUY: "✅ BUY",
  WATCH: "👁 WATCH",
  AVOID: "⛔ AVOID",
};
const REC_RU: Record<string, string> = {
  BUY: "✅ ПОКУПАТЬ",
  WATCH: "👁 НАБЛЮДАТЬ",
  AVOID: "⛔ ИЗБЕГАТЬ",
};

const REC_CLS: Record<string, string> = {
  BUY: "rec-buy",
  WATCH: "rec-watch",
  AVOID: "rec-avoid",
};

const RT_CLS: Record<string, string> = {
  BUY: "rt-buy",
  WATCH: "rt-watch",
  AVOID: "rt-avoid",
};

function compBanner(p: CatalogProject) {
  const q = p.compQ || String(p.compY);
  const s = p.stK;
  const y = p.compY;
  const lbl =
    s === "ready" ? "✓ " : s === "building" ? "🔜 " : "📋 ";
  const cls =
    s === "ready" ? "cdone" : y <= 2026 ? "cnear" : y === 2027 ? "cmid" : "cfar";
  return (
    <span className={`pc-comp ${cls}`}>
      {lbl}
      {q}
    </span>
  );
}

function renderBadges(b: string[] | undefined, ru: boolean) {
  if (!b?.length) return null;
  const out: ReactNode[] = [];
  if (b.includes("rdy"))
    out.push(
      <span key="rdy" className="bdg brdy">
        ✓ {ru ? "Готов" : "Ready"}
      </span>,
    );
  if (b.includes("new"))
    out.push(
      <span key="new" className="bdg bnew">
        NEW
      </span>,
    );
  if (b.includes("set"))
    out.push(
      <span key="set" className="bdg bset">
        SET/SGX
      </span>,
    );
  if (b.includes("hot"))
    out.push(
      <span key="hot" className="bdg bhot">
        🔥 HOT
      </span>,
    );
  if (b.includes("inv"))
    out.push(
      <span key="inv" className="bdg binv">
        {ru ? "Инвентарь" : "Inventory"}
      </span>,
    );
  return <div className="pc-bdg">{out}</div>;
}

export function ProjectCard({
  p,
  lang,
  inShortlist,
  onToggleShortlist,
  onRequestLead,
}: {
  p: CatalogProject;
  lang: "en" | "ru";
  inShortlist: boolean;
  onToggleShortlist: () => void;
  onRequestLead?: () => void;
}) {
  const ru = lang === "ru";
  const showRec = process.env.NEXT_PUBLIC_SHOW_PROJECT_REC === "true";
  const RL = ru ? RISK_RU : RISK_EN;
  const SL = ru ? SEG_RU : SEG_EN;
  const RECL = ru ? REC_RU : REC_EN;
  const BL = ru ? BEACH_RU : BEACH_EN;
  const OL = ru ? OWN_RU : OWN_EN;
  const ML = ru ? MGMT_RU : MGMT_EN;
  const FL = ru ? FOCUS_RU : FOCUS_EN;

  const stC =
    p.stK === "ready" ? "done" : p.stK === "building" ? "near" : "far";

  const wa = `https://wa.me/66922407355?text=${encodeURIComponent(
    (ru ? "Здравствуйте! Меня интересует: " : "Hello! I am interested in: ") +
      p.n +
      " (" +
      p.zone +
      ")",
  )}`;

  return (
    <article className={`pc${showRec && p.rec === "AVOID" ? " avoid" : ""}`}>
      <div className={`pc-stripe ${SC[p.seg] || "s-offplan-new"}`} />
      <div className="pc-head">
        <div className="pc-rat">{p.rat}</div>
        <div className="pc-num">#{p.id}</div>
        <div className="pc-name">
          <Link href={`/project/${projectSlug(p)}`} className="pc-name-link">
            {p.n}
          </Link>
        </div>
        <div className="pc-dev">{p.dev}</div>
        <span className={`pc-risk ${RISK_CLS[p.risk] || "r2"}`}>
          {RISK_EMOJI[p.risk] || "⬜"} {RL[p.risk] || ""}
        </span>
        {compBanner(p)}
        {renderBadges(p.bdg, ru)}
      </div>
      <div className="pc-metrics">
        <div className="mc">
          <div className="mc-v">{p.pT}</div>
          <div className="mc-l">{ru ? "От" : "From"}</div>
        </div>
        <div className="mc">
          <div className="mc-v">{p.pU}</div>
          <div className="mc-l">USD</div>
        </div>
        <div className="mc">
          <div className="mc-v g">{p.yield}</div>
          <div className="mc-l">{ru ? "Доходность" : "Yield est."}</div>
        </div>
      </div>
      <div className="pc-pills">
        {p.beach ? (
          <span className="pl pb">
            🏖 {BL[p.beach] || p.beach}
          </span>
        ) : null}
        {p.own ? (
          <span className="pl po">
            📋 {OL[p.own] || p.own}
          </span>
        ) : null}
        {p.mgmt ? (
          <span className="pl pm">{ML[p.mgmt] || p.mgmt}</span>
        ) : null}
        {p.focus ? (
          <span className="pl pf">
            💡 {FL[p.focus] || p.focus}
          </span>
        ) : null}
        {p.minBR !== undefined ? (
          <span className="pl pd">
            🛏 {p.minBR === 0 ? "Studio+" : `${p.minBR}BR+`}
          </span>
        ) : null}
      </div>
      <div className="pc-body">
        <div className="pc-rows">
          <div className="pr">
            <span className="pr-l">{ru ? "Зона" : "Zone"}</span>
            <span className="pr-v">{p.zone}</span>
          </div>
          <div className="pr">
            <span className="pr-l">{ru ? "Юнитов" : "Units"}</span>
            <span className="pr-v">{p.units || "—"}</span>
          </div>
          <div className="pr">
            <span className="pr-l">฿/sqm</span>
            <span className="pr-v">{p.sqmP || "—"}</span>
          </div>
          <div className="pr">
            <span className="pr-l">{ru ? "Статус" : "Status"}</span>
            <span className={`pr-v ${stC}`}>{p.stT}</span>
          </div>
        </div>
        <div className="pc-desc">{p.desc}</div>
        {showRec ? (
          <div className={`pc-rt ${RT_CLS[p.rec] || "rt-watch"}`}>
            <strong>{RECL[p.rec] || "WATCH"}:</strong> {p.recText || ""}
          </div>
        ) : null}
        <div className="pc-src">📌 {p.src}</div>
        <div className="pc-tags">
          {(p.tags || []).map((tg) => (
            <span key={tg} className="tg">
              {tg}
            </span>
          ))}
        </div>
      </div>
      <div className="pc-foot">
        <span className="pc-seg">{SL[p.seg] || p.seg}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <button
            type="button"
            className="sl-btn"
            title="Shortlist"
            onClick={onToggleShortlist}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              padding: 0,
              lineHeight: 1,
              color: inShortlist ? "var(--red)" : "var(--c-neutral-300)",
            }}
          >
            {inShortlist ? "♥" : "♡"}
          </button>
          {onRequestLead ? (
            <button
              type="button"
              onClick={onRequestLead}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 10,
                background: "var(--gold)",
                color: "var(--ink)",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {ru ? "Заявка" : "Inquiry"}
            </button>
          ) : null}
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 10,
              background: "#25D366",
              color: "#fff",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            WhatsApp
          </a>
          {showRec ? (
            <span className={`pc-rec ${REC_CLS[p.rec] || "rec-watch"}`}>
              {RECL[p.rec] || "WATCH"}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
