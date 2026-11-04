import Image from "next/image";
import Link from "next/link";
import { effectiveLevel, LEVEL_TEXT } from "@/lib/registry/levels";
import type { HomeFeed } from "@/lib/home-feed";
import { priceFromLabel } from "@/lib/home-search";
import { projectSlug } from "@/lib/slug";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { taxLabel, zoneLabel } from "@/lib/taxonomy";
import type { CatalogProject } from "@/lib/types";
import { Scene } from "./Scene";

const STAGE_RU: Record<string, string> = { offplan: "Старт продаж", building: "Строится", ready: "Сдан" };

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

  return (
    <article className="ie-tile">
      <Link href={href} className="ie-tile-link" aria-labelledby={`project-title-${p.id}`}>
      <div className="ie-tile-media">
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
      </div>
      <div className="ie-tile-body">
        <h3 id={`project-title-${p.id}`}>{p.n}</h3>
        <div className="ie-tile-dev">
          Застройщик:{" "}
          <span>{p.dev}</span>
        </div>
        <div className="ie-facts">
          <span className="ie-fact">📍 {zoneLabel(p.zone, "ru")}</span>
          <span className="ie-fact">{taxLabel("type", p.type, "ru")}</span>
          <span className="ie-fact">{p.minBR === 0 ? "от студии" : `от ${p.minBR} спал.`}</span>
          {p.yN > 0 ? <span className="ie-fact">доходность ~{p.yN}%</span> : null}
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
