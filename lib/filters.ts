import { effectiveLevel } from "./registry/levels";
import { searchHaystack } from "./i18n/localize-project";
import type { CatalogProject, RecLabel } from "./types";

export type SortKey =
  | "rating"
  | "comp_asc"
  | "risk"
  | "price_asc"
  | "price_desc"
  | "yield"
  | "beach";

/** Mirrors legacy `getFilters()` + `applyF()` behaviour. */
export interface FilterState {
  fSort: SortKey;
  q: string;
  fRisk: string;
  fSeg: string;
  fType: string;
  fZone: string;
  fStatus: string;
  fYear: string;
  fBeach: string;
  fOwn: string;
  fMgmt: string;
  fFocus: string;
  fDev: string;
  /** BUY | WATCH | AVOID — empty = all */
  fRec: string;
  /** Minimum registry verification level: "" | "1" | "2" */
  fVer: string;
  fSales: string;
}

export const defaultFilterState = (): FilterState => ({
  fSort: "rating",
  q: "",
  fRisk: "",
  fSeg: "",
  fType: "",
  fZone: "",
  fStatus: "",
  fYear: "",
  fBeach: "",
  fOwn: "",
  fMgmt: "",
  fFocus: "",
  fDev: "",
  fRec: "",
  fVer: "",
  fSales: "",
});

const beachOrd: Record<string, number> = { bf: 0, "500": 1, "1k": 2, inl: 3 };

export function filterProjects(
  projects: CatalogProject[],
  f: FilterState,
): CatalogProject[] {
  const q = f.q.toLowerCase().trim();
  return projects.filter((p) => {
    if (
      f.fSales &&
      (f.fSales === "available"
        ? !(Number(p.sales?.available) > 0)
        : p.sales?.stage !== f.fSales)
    )
      return false;
    if (f.fRec && p.rec !== f.fRec) return false;
    if (f.fVer && effectiveLevel(p.ver) < Number(f.fVer)) return false;
    if (f.fSeg && p.seg !== f.fSeg) return false;
    if (f.fType && p.type !== f.fType) return false;
    if (f.fZone && p.zone !== f.fZone) return false;
    if (f.fStatus && p.stK !== f.fStatus) return false;
    if (f.fDev && p.dt !== f.fDev) return false;
    if (f.fBeach && p.beach !== f.fBeach) return false;
    if (f.fOwn && p.own !== f.fOwn && p.own !== "both") return false;
    if (f.fMgmt && p.mgmt !== f.fMgmt) return false;
    if (f.fFocus && p.focus !== f.fFocus && p.focus !== "mixed") return false;
    if (f.fRisk && String(p.risk) !== f.fRisk) return false;
    if (f.fYear) {
      if (f.fYear === "done24" && p.compY !== 2024) return false;
      if (f.fYear === "done25" && p.compY !== 2025) return false;
      if (f.fYear === "2026" && p.compY !== 2026) return false;
      if (f.fYear === "2027" && p.compY !== 2027) return false;
      if (f.fYear === "2028" && (p.compY || 0) < 2028) return false;
    }
    if (q) {
      const hay = searchHaystack(p);
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}

export function sortProjects(
  list: CatalogProject[],
  fSort: SortKey,
): CatalogProject[] {
  const arr = [...list];
  arr.sort((a, b) => {
    if ((fSort === "price_asc" || fSort === "price_desc") && (!(a.pN > 0) || !(b.pN > 0))) return Number(!(a.pN > 0)) - Number(!(b.pN > 0));
    if (fSort === "price_asc") return (a.pN || 0) - (b.pN || 0);
    if (fSort === "price_desc") return (b.pN || 0) - (a.pN || 0);
    if (fSort === "comp_asc") {
      const ya = a.stK === "ready" ? a.compY || 0 : a.compY || 9999;
      const yb = b.stK === "ready" ? b.compY || 0 : b.compY || 9999;
      return ya - yb;
    }
    if (fSort === "yield") return (b.yN || 0) - (a.yN || 0);
    if (fSort === "beach")
      return (beachOrd[a.beach] ?? 3) - (beachOrd[b.beach] ?? 3);
    if (fSort === "risk") return (a.risk || 2) - (b.risk || 2);
    return (b.rat || 0) - (a.rat || 0);
  });
  return arr;
}

export function applyFilters(
  projects: CatalogProject[],
  f: FilterState,
): CatalogProject[] {
  return sortProjects(filterProjects(projects, f), f.fSort);
}

export function countByRec(
  projects: CatalogProject[],
): Record<RecLabel, number> {
  const init: Record<RecLabel, number> = { BUY: 0, WATCH: 0, AVOID: 0 };
  for (const p of projects) init[p.rec] += 1;
  return init;
}

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.fRec) n += 1;
  if (f.fVer) n += 1;
  if (f.fSales) n += 1;
  if (f.q) n += 1;
  if (f.fRisk) n += 1;
  if (f.fSeg) n += 1;
  if (f.fType) n += 1;
  if (f.fZone) n += 1;
  if (f.fStatus) n += 1;
  if (f.fYear) n += 1;
  if (f.fBeach) n += 1;
  if (f.fOwn) n += 1;
  if (f.fMgmt) n += 1;
  if (f.fFocus) n += 1;
  if (f.fDev) n += 1;
  return n;
}
