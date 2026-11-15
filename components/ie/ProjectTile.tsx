"use client";

import { PriceBlock } from "@/components/ui";
import { completionLabel, ownershipLabel } from "@/lib/buyer-display";
import { currentAvailability } from "@/lib/published-availability";
import { usePublicationExpired } from "./usePublicationExpired";
import Image from "next/image";
import Link from "next/link";
import { effectiveLevel, LEVEL_TEXT } from "@/lib/registry/levels";
import type { HomeFeed } from "@/lib/home-feed";
import { priceFromLabel } from "@/lib/home-search";
import { projectSlug } from "@/lib/slug";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { taxLabel, zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";

const STAGE_RU: Record<string, string> = { offplan: "Старт продаж", building: "Строится", ready: "Построен · данные каталога" };

export function ProjectTile({
  p,
  feed,
  selectionSearch = "",
}: {
  p: CatalogProject;
  selectionSearch?: string;
  feed: Pick<HomeFeed, "covers" | "campaigns" | "availability" | "sources">;
}) {
  const href = `/project/${projectSlug(p)}${selectionSearch}`;
  const cover = feed.covers[p.id];
  const promo = feed.campaigns[p.id];
  const avail = feed.availability[p.id];
  usePublicationExpired(avail?.expiresAt);
  const publishedPrice = currentAvailability(avail)?.fromPrice;
  const level = effectiveLevel(p.ver);

  return (
    <article className="ie-tile">
      <Link href={href} className="ie-tile-link" aria-labelledby={`project-title-${p.id}`}>
      <div className={`ie-tile-media${!cover ? " ie-tile-media--empty" : ""}`}>
        {cover ? (
          <Image src={cover.url} alt="" fill sizes="(max-width: 700px) 100vw, 380px" unoptimized referrerPolicy="no-referrer" />
        ) : (
          <div className="ie-property-placeholder" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 40V17l16-9 16 9v23M4 40h40M18 40V28h12v12M17 19h3m8 0h3" /></svg><span>Материалы готовятся</span></div>
        )}
        <div className="ie-badges">
          {cover?.render ? <span className="ie-badge">Визуализация</span> : cover ? <span className="ie-badge">Материал застройщика</span> : null}
          <span className="ie-badge">{STAGE_RU[p.stK] ?? taxLabel("stK", p.stK, "ru", true)}</span>
          {promo ? <span className="ie-badge ie-badge--gold">Акция{promo.labelRu ? `: ${promo.labelRu}` : ""}</span> : null}
          {level > 0 ? <span className="ie-badge ie-badge--ver">{LEVEL_TEXT[level].ruShort}</span> : null}
        </div>
      </div>
      <div className="ie-tile-body">
        <h3 id={`project-title-${p.id}`}>{p.n}</h3>
        <div className="ie-tile-dev">
          Застройщик:{" "}
          <span>{p.dev}</span>
        </div>
        <div className="ie-facts">
          <span className="ie-fact">{zoneLabel(p.zone, "ru")}</span>
          <span className="ie-fact">{taxLabel("type", p.type, "ru")}</span>
          <span className="ie-fact">{p.minBR == null ? "Спальни уточняются" : p.minBR === 0 ? "от студии" : `от ${p.minBR} спал.`}</span>
        </div>
        <div className="ie-tile-summary">
          <PriceBlock label={publishedPrice ? "Цена от по прайсу" : "Цена от"} value={priceFromLabel(p)} unavailable={!publishedPrice} note={publishedPrice ? `${ownershipLabel(publishedPrice.ownership)} · ${publishedPrice.priceDate.split("-").reverse().join(".")}` : undefined} />
          <div className="ie-tile-year"><small>Сроки по данным источника</small><span>{completionLabel(p.compQ || p.compY)}</span></div>
        </div>
        <AvailabilityBadge value={avail} type={p.type} />
        <div className="ie-tile-foot">
          <span>{level > 0 ? "Проверено реестром" : "Данные заявлены застройщиком"}</span>
          <b>Проект и лоты →</b>
        </div>
      </div>
      </Link>
    </article>
  );
}
