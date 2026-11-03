import type { FilterState, SortKey } from "./filters";
import { defaultFilterState } from "./filters";

const SORTS: SortKey[] = [
  "rating",
  "comp_asc",
  "risk",
  "price_asc",
  "price_desc",
  "yield",
  "beach",
];

function parseSort(s: string | null): SortKey {
  if (s && SORTS.includes(s as SortKey)) return s as SortKey;
  return "rating";
}

/** Deserialize filter state from URLSearchParams (shareable links). */
export function filtersFromSearchParams(
  sp: Pick<URLSearchParams, "get">,
): FilterState {
  const d = defaultFilterState();
  d.fSort = parseSort(sp.get("sort"));
  d.q = sp.get("q") ?? "";
  d.fSales = sp.get("sales") ?? "";
  d.fRisk = sp.get("risk") ?? "";
  d.fSeg = sp.get("seg") ?? "";
  d.fType = sp.get("type") ?? "";
  d.fZone = sp.get("zone") ?? "";
  d.fStatus = sp.get("status") ?? "";
  d.fYear = sp.get("year") ?? "";
  d.fBeach = sp.get("beach") ?? "";
  d.fOwn = sp.get("own") ?? "";
  d.fMgmt = sp.get("mgmt") ?? "";
  d.fFocus = sp.get("focus") ?? "";
  d.fDev = sp.get("dev") ?? "";
  d.fRec = sp.get("rec") ?? "";
  d.fVer = ["1", "2"].includes(sp.get("ver") ?? "")
    ? (sp.get("ver") as string)
    : "";
  return d;
}

export function filtersToSearchParams(
  f: FilterState,
): Record<string, string | undefined> {
  const o: Record<string, string | undefined> = {};
  if (f.fSort !== "rating") o.sort = f.fSort;
  if (f.q) o.q = f.q;
  if (f.fSales) o.sales = f.fSales;
  if (f.fRisk) o.risk = f.fRisk;
  if (f.fSeg) o.seg = f.fSeg;
  if (f.fType) o.type = f.fType;
  if (f.fZone) o.zone = f.fZone;
  if (f.fStatus) o.status = f.fStatus;
  if (f.fYear) o.year = f.fYear;
  if (f.fBeach) o.beach = f.fBeach;
  if (f.fOwn) o.own = f.fOwn;
  if (f.fMgmt) o.mgmt = f.fMgmt;
  if (f.fFocus) o.focus = f.fFocus;
  if (f.fDev) o.dev = f.fDev;
  if (f.fRec) o.rec = f.fRec;
  if (f.fVer) o.ver = f.fVer;
  return o;
}
