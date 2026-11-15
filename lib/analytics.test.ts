import { describe, expect, it } from "vitest";
import { groupBy, median, parseSqmPrice, parseUnits, summarize } from "./analytics";
import type { CatalogProject } from "./types";

const mk = (o: Partial<CatalogProject>): CatalogProject =>
  ({ id: 1, n: "T", dev: "Dev A", dt: "DevA", zone: "Layan", seg: "condo", type: "condo", pT: "", pN: 10, pU: "", sqmP: "н/д", units: "50", unitSzM2: "", minBR: 1, stK: "building", stT: "", compY: 2027, compQ: "", beach: "500", own: "fh", mgmt: "pro", focus: "STR", yield: "", yN: 6, rat: 0, risk: 2, desc: "", tags: [], bdg: [], rec: "WATCH", recText: "", src: "", ...o }) as CatalogProject;

describe("parsers", () => {
  it("units: leading integer only", () => {
    expect(parseUnits("455 (Park Residences phase)")).toBe(455);
    expect(parseUnits("1,200")).toBe(1200);
    expect(parseUnits("н/д")).toBeNull();
  });
  it("price per sqm: midpoint of a range, plausible values only", () => {
    expect(parseSqmPrice("220,000–350,000")).toBe(285000);
    expect(parseSqmPrice("157,422")).toBe(157422);
    expect(parseSqmPrice("н/д")).toBeNull();
    expect(parseSqmPrice("50")).toBeNull();
  });
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("summarize / groupBy", () => {
  const ps = [
    mk({ id: 1, pN: 5, zone: "Layan", type: "villa", dt: "A", stK: "ready", compY: 2025, units: "10" }),
    mk({ id: 2, pN: 15, zone: "Layan", type: "condo", dt: "B", compY: 2027, units: "100" }),
    mk({ id: 3, pN: 0, zone: "Kata", type: "condo", dt: "B", stK: "offplan", compY: 2028, units: "н/д", yN: 0 }),
  ];
  it("counts projects, developers, locations and ignores missing prices", () => {
    const s = summarize(ps);
    expect(s.projects).toBe(3);
    expect(s.developers).toBe(2);
    expect(s.locations).toBe(2);
    expect(s.price).toMatchObject({ min: 5, max: 15, median: 10, n: 2 });
    expect(s.units).toEqual({ total: 110, coveredProjects: 2 });
    expect(s.yield).toMatchObject({ avg: 6, n: 2 });
    expect(s.stage).toEqual({ offplan: 1, building: 1, ready: 1, unknown: 0 });
    expect(s.byType).toEqual({ villa: 1, condo: 2 });
    expect(s.byYear.map((y) => y.year)).toEqual([2025, 2027, 2028]);
    expect(s.buckets.find((b) => b.key === "lt5")?.projects).toBe(1);
    expect(s.buckets.find((b) => b.key === "10-20")?.projects).toBe(1);
  });
  it("groups by location ordered by project count", () => {
    const g = groupBy(ps, (p) => p.zone, (p) => p.zone);
    expect(g.map((r) => [r.key, r.projects])).toEqual([["Layan", 2], ["Kata", 1]]);
    expect(g[0].median).toBe(10);
    expect(g[0].developers).toBe(2);
  });
});
