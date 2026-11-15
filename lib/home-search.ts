import { projectPriceM } from "./buyer-display";
import { SEGMENTS, taxLabel, zoneLabel } from "./taxonomy";
import type { CatalogProject } from "./types";

/**
 * Home search: free text with a few natural-language hints ("вилла Layan до 30 млн, 2 спальни, 2027")
 * plus explicit filters. Pure functions, no I/O; the UI keeps this state in the URL.
 */
export type HomeFilters = {
  view: string;
  q: string;
  zone: string;
  type: string;
  stage: string;
  budget: string;
  year: string;
  bedrooms: string;
  ownership: string;
  sort: string;
};

export const EMPTY_FILTERS: HomeFilters = {
  view: "list",
  q: "",
  zone: "",
  type: "",
  stage: "",
  budget: "",
  year: "",
  bedrooms: "",
  ownership: "",
  sort: "rating",
};

export const BUDGET_STEPS = [5, 10, 20, 50, 100] as const;
export const SORTS = ["rating", "price-asc", "price-desc", "year"] as const;

export type ParsedQuery = {
  terms: string[];
  maxPriceM?: number;
  minBR?: number;
  year?: number;
  type?: "condo" | "villa" | "house";
};

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").trim();

// JS `\b` is ASCII-only and breaks on Cyrillic: use explicit Unicode lookarounds.
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const re = (src: string, flags = "u") => new RegExp(src, flags);

export function parseQuery(raw: string): ParsedQuery {
  let q = " " + norm(raw) + " ";
  const out: ParsedQuery = { terms: [] };

  const price = q.match(re(`(?:до|<=?|under|up to)\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:млн|м${E}|m${E}|million)`));
  if (price) {
    out.maxPriceM = Number(price[1].replace(",", "."));
    q = q.replace(price[0], " ");
  }
  const br = q.match(re(`(\\d)\\s*(?:спал\\p{L}*|br${E}|bd${E}|bedroom\\p{L}*)`));
  if (br) {
    out.minBR = Number(br[1]);
    q = q.replace(br[0], " ");
  } else if (re(`${B}студи[яи]${E}`).test(q)) {
    out.minBR = 0;
    q = q.replace(re(`${B}студи[яи]${E}`), " ");
  }
  const year = q.match(re(`${B}(20[2-4]\\d)${E}`));
  if (year) {
    out.year = Number(year[1]);
    q = q.replace(year[0], " ");
  }
  const villa = re(`${B}(?:вилл|villa)\\p{L}*`, "gu");
  const condo = re(`${B}(?:кондо|кварти|apartment|condo)\\p{L}*`, "gu");
  const house = re(`${B}(?:дом|house)\\p{L}*`, "gu");
  if (villa.test(q)) {
    out.type = "villa";
    q = q.replace(villa, " ");
  } else if (condo.test(q)) {
    out.type = "condo";
    q = q.replace(condo, " ");
  } else if (house.test(q)) {
    out.type = "house";
    q = q.replace(house, " ");
  }
  out.terms = q.split(/[\s,;]+/).filter((t) => t.length > 0);
  return out;
}

export type SearchProject = Pick<CatalogProject, "id" | "n" | "dev" | "dt" | "zone" | "seg" | "type" | "tags" | "stK" | "compY" | "pN" | "sales">;
function haystack(p: SearchProject): string {
  return norm(
    [
      p.n,
      p.dev,
      p.dt,
      p.zone,
      zoneLabel(p.zone, "ru"),
      taxLabel("seg", p.seg, "ru"),
      taxLabel("type", p.type, "ru"),
      ...(p.tags ?? []),
    ].join(" | "),
  );
}

const STAGE_MATCH: Record<string, (p: SearchProject) => boolean> = {
  unknown: (p) => p.stK === "unknown",
  offplan: (p) => p.stK === "offplan",
  building: (p) => p.stK === "building",
  ready: (p) => p.stK === "ready",
};

export function filterProjects<T extends SearchProject>(all: T[], f: HomeFilters): T[] {
  const pq = parseQuery(f.q);
  const budget = f.budget ? Number(f.budget) : pq.maxPriceM;
  const type = f.type || pq.type;
  const year = f.year ? Number(f.year) : pq.year;
  const desiredBedrooms = f.bedrooms || (pq.minBR != null ? String(pq.minBR) : "");
  const stageFn = f.stage ? STAGE_MATCH[f.stage] : undefined;

  const list = all.filter((p) => {
    if (f.zone && p.zone !== f.zone) return false;
    if (type && p.type !== type) return false;
    if (stageFn && !stageFn(p)) return false;
    const price = projectPriceM(p, f.ownership, desiredBedrooms);
    if ((f.ownership || desiredBedrooms) && !(price > 0)) return false;
    if (budget != null && Number.isFinite(budget) && (!(price > 0) || price > budget)) return false;
    if (year != null && p.compY !== year) return false;
    if (pq.terms.length) {
      const h = haystack(p);
      if (!pq.terms.every((t) => h.includes(t))) return false;
    }
    return true;
  });

  const by = f.sort;
  return [...list].sort((a, b) => {
    const ap=projectPriceM(a,f.ownership,desiredBedrooms),bp=projectPriceM(b,f.ownership,desiredBedrooms);
    if ((by === "price-asc" || by === "price-desc") && (!(ap > 0) || !(bp > 0))) return Number(!(ap > 0)) - Number(!(bp > 0));
    if (by === "price-asc") return ap - bp;
    if (by === "price-desc") return bp - ap;
    if (by === "year") return (a.compY ?? Infinity) - (b.compY ?? Infinity) || a.pN - b.pN;
    // Keep the legacy URL sort key, but use a neutral catalogue order.
    return a.id - b.id;
  });
}

export function filtersFromParams(p: URLSearchParams): HomeFilters {
  const get = (k: string) => p.get(k) ?? "";
  const sort = get("sort");
  return {
    view: get("view") === "map" ? "map" : "list",
    q: get("q"),
    zone: get("zone"),
    type: get("type"),
    stage: get("stage"),
    budget: get("budget"),
    year: get("year"),
    bedrooms: get("bedrooms"),
    ownership: get("ownership"),
    sort: (SORTS as readonly string[]).includes(sort) ? sort : "rating",
  };
}

export function filtersToParams(f: HomeFilters): URLSearchParams {
  const p = new URLSearchParams();
  (Object.keys(EMPTY_FILTERS) as (keyof HomeFilters)[]).forEach((k) => {
    if (f[k] && f[k] !== EMPTY_FILTERS[k]) p.set(k, f[k]);
  });
  return p;
}

export function hasActiveFilters(f: HomeFilters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof HomeFilters)[]).some(
    (k) => k !== "sort" && k !== "view" && !!f[k],
  );
}

export const SEGMENT_KEYS = SEGMENTS;

/** "฿315M+" style price; falls back to the stored label. */
export function priceFromLabel(p: CatalogProject): string {
  const price = projectPriceM(p);
  if (!(price > 0) || p.pT === "POA") return "Цена уточняется";
  return p.pT || (p.pN ? `฿${p.pN}M+` : "по запросу");
}
