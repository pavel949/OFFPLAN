import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filterProjects, filtersFromParams, filtersToParams, parseQuery } from "./home-search";
import type { CatalogProject } from "./types";

const mk = (o: Partial<CatalogProject>): CatalogProject =>
  ({
    id: 1, n: "Test", dev: "Dev Co", dt: "Dev", zone: "Layan", seg: "condo", type: "condo", pT: "฿10M+", pN: 10,
    pU: "", sqmP: "", units: "10", unitSzM2: "", minBR: 1, stK: "building", stT: "", compY: 2027, compQ: "", beach: "500",
    own: "fh", mgmt: "pro", focus: "STR", yield: "", yN: 0, rat: 0, risk: 2, desc: "", tags: [], bdg: [], rec: "WATCH", recText: "", src: "",
    ...o,
  }) as CatalogProject;

const all = [
  mk({ id: 1, n: "Layan Villas", zone: "Layan", type: "villa", pN: 28, compY: 2027, minBR: 3, rat: 8 }),
  mk({ id: 2, n: "Bang Tao Condo", zone: "Bang Tao", type: "condo", pN: 6, compY: 2026, minBR: 1, stK: "ready", rat: 7 }),
  mk({ id: 3, n: "Kata Residence", zone: "Kata", type: "condo", pN: 12, compY: 2028, minBR: 0, stK: "offplan" }),
];

describe("parseQuery", () => {
  it("extracts price, bedrooms, year and type hints", () => {
    const q = parseQuery("вилла Layan до 30 млн, 3 спальни 2027");
    expect(q.maxPriceM).toBe(30);
    expect(q.minBR).toBe(3);
    expect(q.year).toBe(2027);
    expect(q.type).toBe("villa");
    expect(q.terms).toEqual(["layan"]);
  });
  it("handles studio and decimal prices", () => {
    expect(parseQuery("студия до 7,5 млн")).toMatchObject({ minBR: 0, maxPriceM: 7.5 });
  });
});

describe("filterProjects", () => {
  it("applies natural-language hints", () => {
    expect(filterProjects(all, { ...EMPTY_FILTERS, q: "вилла до 30 млн 2027" }).map((p) => p.id)).toEqual([1]);
  });
  it("matches by name, developer and zone label text", () => {
    expect(filterProjects(all, { ...EMPTY_FILTERS, q: "kata" }).map((p) => p.id)).toEqual([3]);
    expect(filterProjects(all, { ...EMPTY_FILTERS, q: "dev co" })).toHaveLength(3);
  });
  it("combines explicit filters and sorts unrated last by default", () => {
    expect(filterProjects(all, { ...EMPTY_FILTERS, budget: "20" }).map((p) => p.id)).toEqual([2, 3]);
    expect(filterProjects(all, { ...EMPTY_FILTERS, stage: "ready" }).map((p) => p.id)).toEqual([2]);
    expect(filterProjects(all, EMPTY_FILTERS).map((p) => p.id)).toEqual([1, 2, 3]);
    expect(filterProjects(all, { ...EMPTY_FILTERS, sort: "price-asc" }).map((p) => p.id)).toEqual([2, 3, 1]);
  });
});

describe("url state", () => {
  it("round-trips and omits defaults", () => {
    const f = { ...EMPTY_FILTERS, q: "kata", zone: "Kata", budget: "20" };
    const p = filtersToParams(f);
    expect(p.toString()).toBe("q=kata&zone=Kata&budget=20");
    expect(filtersFromParams(p)).toEqual(f);
    expect(filtersFromParams(new URLSearchParams("sort=hack")).sort).toBe("rating");
  });
});
