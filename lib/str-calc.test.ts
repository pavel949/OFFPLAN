import { describe, expect, it } from "vitest";
import type { StrCalcResult } from "./str-calc";
import { computeStrCalc, costBarSegments } from "./str-calc";

const zeroCostTotal = (): StrCalcResult => ({
  grossIncome: 0,
  mgmtCost: 0,
  netBeforeTax: 0,
  camAnnual: 0,
  taxable: 0,
  tax: 0,
  netIncome: 0,
  grossYieldPct: 0,
  netYieldPct: 0,
  paybackYears: null,
  exit5: 0,
  costTotal: 0,
});

describe("str-calc", () => {
  it("costBarSegments returns zeros when total is 0 or non-finite", () => {
    expect(costBarSegments(zeroCostTotal())).toEqual({
      mgmt: 0,
      cam: 0,
      tax: 0,
      net: 0,
    });
    expect(
      costBarSegments({ ...zeroCostTotal(), costTotal: Number.NaN }),
    ).toEqual({ mgmt: 0, cam: 0, tax: 0, net: 0 });
  });

  it("costBarSegments sums to ~100% for normal inputs", () => {
    const r = computeStrCalc({
      price: 10_000_000,
      sqm: 45,
      adr: 3500,
      occPct: 68,
      mgmtPct: 40,
      camPerSqmMonth: 80,
      appreciationPct: 6,
    });
    const b = costBarSegments(r);
    const sum = b.mgmt + b.cam + b.tax + b.net;
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });
});
