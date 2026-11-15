import { filtersFromParams, filtersToParams, parseQuery, type HomeFilters } from "./home-search";

export type UnitSelection = { budget: string; bedrooms: string; ownership: string };

/** Carry effective catalogue criteria, including natural-language hints, into units. */
export function unitSelection(filters: HomeFilters): UnitSelection {
  const parsed = parseQuery(filters.q);
  const budget = filters.budget || (parsed.maxPriceM == null ? "" : String(parsed.maxPriceM));
  const bedrooms = filters.bedrooms || (parsed.minBR == null ? "" : String(parsed.minBR));
  return {
    budget: budget !== "" && Number.isFinite(Number(budget)) && Number(budget) >= 0 ? budget : "",
    bedrooms: /^\d+$/.test(bedrooms) ? bedrooms : "",
    ownership: ["freehold", "leasehold", "other", "unknown"].includes(filters.ownership) ? filters.ownership : "",
  };
}

export function projectSelectionSearch(filters: HomeFilters): string {
  const query = filtersToParams(filters).toString();
  return query ? `?${query}` : "";
}

export function selectionFromSearch(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const filters = filtersFromParams(query);
  return { selection: unitSelection(filters), search: projectSelectionSearch(filters) };
}
