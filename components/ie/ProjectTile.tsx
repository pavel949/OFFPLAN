import Image from "next/image";
import Link from "next/link";
import { effectiveLevel, LEVEL_TEXT } from "@/lib/registry/levels";
import { developerSlug } from "@/lib/developers";
import type { HomeFeed } from "@/lib/home-feed";
import { priceFromLabel } from "@/lib/home-search";
import { locationSlug, projectSlug } from "@/lib/slug";
import { SOURCE_KIND_LABEL_RU } from "@/lib/sources";
import { taxLabel, zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";
import { Scene } from "./Scene";

const STAGE_RU: Record<string, string> = { offplan: "Старт продаж", building: "Строится", ready: "Сдан" };

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function ProjectTile({
  p,
  feed,
}: {
  p: CatalogProject;
  feed: Pick<HomeFeed, "covers" | "campaigns" | "availability" | "sources">;
}) {
  const href = `/project/${projectSlug(p)}`;
  const cover = feed.covers[p.id];
  const promo = feed.campaigns[p.id];
  const avail = feed.availability[p.id];
  const level = effectiveLevel(p.ver);
  const material = (feed.sources[p.id] ?? [])[0];
  const total = Number(String(p.units).replace(/\D/g, "")) || null;
  const soldPct =
    avail?.available != null && total && total >= avail.available
      ? Math.round(((total - avail.available) / total) * 100)
      : null;

  return (
    <article className="ie-tile">
      <Link href={href} className="ie-tile-media" tabIndex={-1} aria-hidden="true">
        {cover ? (
          <Image src={cover.url} alt="" fill sizes="(max-width: 700px) 100vw, 380px" unoptimized referrerPolicy="no-referrer" />
        ) : (
          <Scene seed={p.id} kind={p.type === "condo" ? "condo" : p.type === "house" ? "house" : "villa"} />
        )}
        <div className="ie-badges">
          <span className="ie-badge">{STAGE_RU[p.stK] ?? taxLabel("stK", p.stK, "ru", true)}</span>
          {promo ? <span className="ie-badge ie-badge--gold">Акция{promo.labelRu ? `: ${promo.labelRu}` : ""}</span> : null}
          {level > 0 ? <span className="ie-badge ie-badge--ver">🛡 {LEVEL_TEXT[level].ruShort}</span> : null}
        </div>
        <div className="ie-tile-price">
          <small>Цена от</small>
          <b>{priceFromLabel(p)}</b>
        </div>
        <div className="ie-tile-year">
          Сдача
          <br />
          {p.compQ && p.compQ !== String(p.compY) ? p.compQ : p.compY}
        </div>
      </Link>
      <div className="ie-tile-body">
        <h3>
          <Link href={href}>{p.n}</Link>
        </h3>
        <div className="ie-tile-dev">
          Застройщик:{" "}
          <Link href={`/developers/${developerSlug(p.dt)}`}>{p.dev}</Link>
        </div>
        <div className="ie-facts">
          <Link href={`/locations/${locationSlug(p.zone)}`} className="ie-fact" style={{ position: "relative", zIndex: 2, textDecoration: "none" }}>📍 {zoneLabel(p.zone, "ru")}</Link>
          <span className="ie-fact">{taxLabel("type", p.type, "ru")}</span>
          <span className="ie-fact">{p.minBR === 0 ? "от студии" : `от ${p.minBR} спал.`}</span>
          {p.yN > 0 ? <span className="ie-fact">доходность ~{p.yN}%</span> : null}
        </div>
        {soldPct != null ? (
          <div title={`Свободно ${avail?.available} из ${total}`}>
            <div className="ie-meter" role="img" aria-label={`Продано ${soldPct}%`}>
              <i style={{ width: `${soldPct}%` }} />
            </div>
          </div>
        ) : null}
        <div className="ie-tile-foot">
          <span>
            {avail?.available != null
              ? `В продаже: ${avail.available} лот.${avail.recorded ? ` · обновлено ${daysAgo(avail.recorded)} дн. назад` : ""}`
              : level > 0
                ? "Проверено реестром"
                : "Данные заявлены застройщиком"}
          </span>
          {material ? (
            <a href={material.url} target="_blank" rel="noopener noreferrer nofollow">
              {SOURCE_KIND_LABEL_RU[material.kind]} ↗
            </a>
          ) : (
            <Link href={href}>Досье →</Link>
          )}
        </div>
      </div>
    </article>
  );
}
