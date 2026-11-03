import { describe, expect, it } from "vitest";
import type { CatalogProject } from "./types";
import {
  applyFilters,
  countByRec,
  defaultFilterState,
  filterProjects,
} from "./filters";

const sample: CatalogProject[] = [
  {
    id: 1,
    n: "Alpha Bang Tao",
    dev: "X",
    dt: "SANS",
    zone: "Bang Tao",
    seg: "condo",
    type: "condo",
    pT: "฿10M",
    pN: 10,
    pU: "",
    sqmP: "",
    units: "",
    unitSzM2: "",
    minBR: 1,
    stK: "building",
    stT: "",
    compY: 2026,
    compQ: "",
    beach: "bf",
    own: "fh",
    mgmt: "pro",
    focus: "str",
    yield: "6%",
    yN: 6,
    rat: 8,
    risk: 2,
    desc: "",
    tags: [],
    bdg: [],
    rec: "BUY",
    recText: "",
    src: "",
  },
  {
    id: 2,
    n: "Beta Rawai",
    dev: "Y",
    dt: "PHU",
    zone: "Rawai",
    seg: "condo",
    type: "condo",
    pT: "฿5M",
    pN: 5,
    pU: "",
    sqmP: "",
    units: "",
    unitSzM2: "",
    minBR: 1,
    stK: "building",
    stT: "",
    compY: 2027,
    compQ: "",
    beach: "500",
    own: "lh",
    mgmt: "owner",
    focus: "mixed",
    yield: "5%",
    yN: 5,
    rat: 7,
    risk: 3,
    desc: "",
    tags: [],
    bdg: [],
    rec: "WATCH",
    recText: "",
    src: "",
  },
];

describe("filters", () => {
  it("counts BUY/WATCH/AVOID parity with full list", () => {
    const c = countByRec(sample);
    expect(c.BUY + c.WATCH + c.AVOID).toBe(sample.length);
  });

  it("filter by zone substring (legacy indexOf)", () => {
    const f = defaultFilterState();
    f.fZone = "Bang Tao";
    expect(filterProjects(sample, f)).toHaveLength(1);
  });

  it("zone filter requires substring match (wrong zone finds nothing)", () => {
    const f = defaultFilterState();
    f.fZone = "Patong";
    expect(filterProjects(sample, f)).toHaveLength(0);
  });

  it("applyFilters rec filter", () => {
    const f = defaultFilterState();
    f.fRec = "BUY";
    expect(applyFilters(sample, f)).toHaveLength(1);
  });
});

describe("zone/developer filters use exact match", () => {
  it("does not match on substrings", () => {
    const p = { ...sample[0], zone: "Kata", dt: "Banyan" };
    const q = { ...sample[0], id: 2, zone: "Kata Noi", dt: "BanyanX" };
    const f = { ...defaultFilterState(), fZone: "Kata" };
    expect(filterProjects([p, q], f).map((x) => x.id)).toEqual([p.id]);
    const g = { ...defaultFilterState(), fDev: "Banyan" };
    expect(filterProjects([p, q], g).map((x) => x.id)).toEqual([p.id]);
  });
});

it("sales filters distinguish unknown stock from declared sales stage", () => {
  const rows = [
    { ...sample[0], sales: { stage: "launch", available: 2, recorded: 3 } },
    { ...sample[1] },
  ];
  const f = defaultFilterState();
  f.fSales = "available";
  expect(filterProjects(rows, f).map((p) => p.id)).toEqual([1]);
  f.fSales = "sold_out";
  expect(filterProjects(rows, f)).toEqual([]);
  f.fSales = "launch";
  expect(filterProjects(rows, f).map((p) => p.id)).toEqual([1]);
});
