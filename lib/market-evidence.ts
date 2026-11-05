import type { FilterState } from "./filters";

/** Old shared links must not silently re-enable unsubstantiated recommendations,
 * risk filters or score/yield ordering. These values remain legacy data, not evidence. */
export function marketFilters(filters: FilterState): FilterState {
  return {
    ...filters,
    fRisk: "",
    fRec: "",
    fSort: ["rating", "risk", "yield"].includes(filters.fSort) ? "name" : filters.fSort,
  };
}
