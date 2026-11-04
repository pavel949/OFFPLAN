"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { projectSlug } from "@/lib/slug";
import { VerificationBadge } from "./VerificationBadge";
import { taxLabel, zoneLabel, type TaxonomyKind } from "@/lib/taxonomy";
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
const RISK_CLS: Record<number, string> = { 1: "r1", 2: "r2", 3: "r3" };
const MGMT_EMOJI: Record<string, string> = { hotel: "🏨 ", pro: "👥 " };

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
  const q = p.compQ || (p.compY == null ? "Срок не подтверждён" : String(p.compY));
  const s = p.stK;
  const y = p.compY ?? Infinity;
  const lbl = s === "unknown" ? "" : s === "ready" ? "✓ " : s === "building" ? "🔜 " : "📋 ";
  const cls =
    s === "ready"
      ? "cdone"
      : y <= 2026
        ? "cnear"
        : y === 2027
          ? "cmid"
          : "cfar";
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
        ✓ {ru ? "Сдан" : "Ready"}
      </span>,
    );
  if (b.includes("new"))
    out.push(
      <span key="new" className="bdg bnew">
        {ru ? "НОВИНКА" : "NEW"}
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
        {ru ? "В наличии" : "Inventory"}
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
  const tl = (kind: TaxonomyKind, key: string | number) =>
    taxLabel(kind, key, lang, true);

  const stC =
    p.stK === "ready" ? "done" : p.stK === "building" ? "near" : "far";

  const wa = `https://wa.me/66922407355?text=${encodeURIComponent(
    (ru ? "Здравствуйте! Меня интересует: " : "Hello! I am interested in: ") +
      p.n +
      " (" +
      zoneLabel(p.zone, lang) +
      ")",
  )}`;

  return (
    <article className={`pc${showRec && p.rec === "AVOID" ? " avoid" : ""}`}>
      <div className={`pc-stripe ${SC[p.seg] || "s-offplan-new"}`} />
      <div className="pc-head">
        <div className="pc-rat">{p.rat != null && p.rat > 0 ? p.rat : "—"}</div>
        <div className="pc-num">#{p.id}</div>
        <div className="pc-name">
          <Link href={`/project/${projectSlug(p)}`} className="pc-name-link">
            {p.n}
          </Link>
        </div>
        <div className="pc-dev">{p.dev}</div>
        <div style={{ margin: "2px 0 4px" }}>
          <VerificationBadge ver={p.ver} lang={lang} />
        </div>
        <span className={`pc-risk ${(p.risk == null ? "" : RISK_CLS[p.risk]) || ""}`}>
          {(p.risk == null ? "⬜" : RISK_EMOJI[p.risk]) || "⬜"} {p.risk == null ? (ru ? "Риск не оценён" : "Risk not assessed") : tl("risk", p.risk)}
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
          <div className="mc-v">{p.sales?.available ?? "—"}</div>
          <div className="mc-l">
            {ru ? "Внесено свободных" : "Recorded available"}
          </div>
        </div>
      </div>
      <div className="pc-pills">
        {p.beach ? (
          <span className="pl pb">🏖 {tl("beach", p.beach)}</span>
        ) : null}
        {p.own ? <span className="pl po">📋 {tl("own", p.own)}</span> : null}
        {p.mgmt ? (
          <span className="pl pm">
            {MGMT_EMOJI[p.mgmt] ?? ""}
            {tl("mgmt", p.mgmt)}
          </span>
        ) : null}
        {p.focus ? (
          <span className="pl pf">💡 {tl("focus", p.focus)}</span>
        ) : null}
        {p.minBR != null ? (
          <span className="pl pd">
            🛏{" "}
            {p.minBR === 0
              ? ru
                ? "Студия+"
                : "Studio+"
              : ru
                ? `от ${p.minBR} спал.`
                : `${p.minBR}BR+`}
          </span>
        ) : null}
      </div>
      <div className="pc-body">
        <div className="pc-rows">
          <div className="pr">
            <span className="pr-l">{ru ? "Зона" : "Zone"}</span>
            <span className="pr-v">{zoneLabel(p.zone, lang)}</span>
          </div>
          <div className="pr">
            <span className="pr-l">{ru ? "Юнитов" : "Units"}</span>
            <span className="pr-v">{p.units || "—"}</span>
          </div>
          <div className="pr">
            <span className="pr-l">{ru ? "฿/м²" : "฿/sqm"}</span>
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
            <strong>{tl("rec", p.rec)}:</strong> {p.recText || ""}
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
        <span className="pc-seg">{tl("seg", p.seg)}</span>
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
              {tl("rec", p.rec)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
