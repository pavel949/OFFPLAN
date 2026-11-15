import { developerSlug } from "./developers";
import type { CatalogProject } from "./types";

/**
 * Market analytics computed from the live catalogue. Everything here is a pure function of the project
 * list, so a project entered anywhere (any location, any developer) is counted automatically.
 * Prices in the catalogue are millions of THB (`pN`); other currencies need a per-jurisdiction rate table
 * before mixed-currency catalogues can be aggregated (see docs/ARCHITECTURE.md).
 */

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** "455 (Park Residences phase)" → 455; "н/д" → null. Only a leading integer counts. */
export function parseUnits(units: string): number | null {
  const m = String(units ?? "").trim().match(/^(\d[\d,. ]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/[ ,]/g, ""));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
}

/** "220,000–350,000" → 285000; "157,422" → 157422; "н/д" → null (THB per sqm, plausible range only). */
export function parseSqmPrice(s: string): number | null {
  const nums = (String(s ?? "").match(/\d[\d,]*/g) ?? []).map((x) => Number(x.replace(/,/g, ""))).filter((n) => n >= 20_000 && n <= 3_000_000);
  if (!nums.length) return null;
  return nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
}

export const PRICE_BUCKETS = [
  { key: "lt5", label: "до 5 млн", max: 5 },
  { key: "5-10", label: "5–10 млн", max: 10 },
  { key: "10-20", label: "10–20 млн", max: 20 },
  { key: "20-50", label: "20–50 млн", max: 50 },
  { key: "gt50", label: "от 50 млн", max: Infinity },
] as const;

export type Summary = {
  projects: number;
  developers: number;
  locations: number;
  units: { total: number; coveredProjects: number };
  price: { min: number | null; median: number | null; max: number | null; n: number };
  perSqm: { median: number | null; n: number };
  yield: { avg: number | null; n: number };
  stage: { offplan: number; building: number; ready: number; unknown: number };
  byType: Record<string, number>;
  byYear: { year: number; projects: number; units: number }[];
  buckets: { key: string; label: string; projects: number }[];
};

export function summarize(ps: CatalogProject[]): Summary {
  const prices = ps.map((p) => p.pN).filter((n) => n > 0);
  const perSqm = ps.map((p) => parseSqmPrice(p.sqmP)).filter((n): n is number => n != null);
  const yields = ps.map((p) => p.yN).filter((n) => n > 0);
  const unitsArr = ps.map((p) => parseUnits(p.units)).filter((n): n is number => n != null);
  const byType: Record<string, number> = {};
  const years = new Map<number, { projects: number; units: number }>();
  const stage = { offplan: 0, building: 0, ready: 0, unknown: 0 };
  for (const p of ps) {
    byType[p.type] = (byType[p.type] ?? 0) + 1;
    if (p.stK in stage) stage[p.stK as keyof typeof stage] += 1;
    if (p.compY == null) continue;
    const y = years.get(p.compY) ?? { projects: 0, units: 0 };
    y.projects += 1;
    y.units += parseUnits(p.units) ?? 0;
    years.set(p.compY, y);
  }
  return {
    projects: ps.length,
    developers: new Set(ps.map((p) => developerSlug(p.dt))).size,
    locations: new Set(ps.map((p) => p.zone)).size,
    units: { total: unitsArr.reduce((a, b) => a + b, 0), coveredProjects: unitsArr.length },
    price: { min: prices.length ? Math.min(...prices) : null, median: median(prices), max: prices.length ? Math.max(...prices) : null, n: prices.length },
    perSqm: { median: median(perSqm), n: perSqm.length },
    yield: { avg: avg(yields), n: yields.length },
    stage,
    byType,
    byYear: [...years].map(([year, v]) => ({ year, ...v })).sort((a, b) => a.year - b.year),
    buckets: PRICE_BUCKETS.map((b, i) => {
      const lo = i === 0 ? 0 : PRICE_BUCKETS[i - 1].max;
      return { key: b.key, label: b.label, projects: prices.filter((n) => n > lo && n <= b.max).length };
    }),
  };
}

export type GroupRow = {
  key: string;
  label: string;
  projects: number;
  median: number | null;
  yieldAvg: number | null;
  ready: number;
  types: Record<string, number>;
  developers: number;
  units: number;
};

export function groupBy(ps: CatalogProject[], keyOf: (p: CatalogProject) => string, labelOf: (p: CatalogProject) => string): GroupRow[] {
  const g = new Map<string, CatalogProject[]>();
  for (const p of ps) {
    const k = keyOf(p);
    (g.get(k) ?? g.set(k, []).get(k)!).push(p);
  }
  return [...g]
    .map(([key, list]) => {
      const s = summarize(list);
      return {
        key,
        label: labelOf(list[0]),
        projects: list.length,
        median: s.price.median,
        yieldAvg: s.yield.avg,
        ready: s.stage.ready,
        types: s.byType,
        developers: s.developers,
        units: s.units.total,
      };
    })
    .sort((a, b) => b.projects - a.projects || a.label.localeCompare(b.label));
}

/** Millions of THB → "฿7.5M"; missing → "—". */
export function fmtM(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return `฿${v}M`;
}
export function fmtPct(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n * 10) / 10}%`;
}
export function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : Math.round(n).toLocaleString("ru-RU");
}
export const TYPE_RU: Record<string, string> = {
  unknown: "Тип не подтверждён", condo: "Кондо", villa: "Виллы", house: "Дома" };
