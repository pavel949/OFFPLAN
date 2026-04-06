import { describe, expect, it } from "vitest";
import { computeCalcStr } from "./calcStr";

/** Defaults from Ignatev legacy HTML (cPrice 10M, cSqm 45, etc.) */
describe("computeCalcStr", () => {
  it("matches legacy calcUpdate() snapshot for default sliders", () => {
    const r = computeCalcStr({
      price: 10_000_000,
      sqm: 45,
      adr: 3500,
      occPct: 68,
      mgmtPctOfGross: 40,
      camPerSqmMonth: 80,
      appreciationPct: 6,
    });

    expect(r.grossIncome).toBeCloseTo(868_700, 6);
    expect(r.mgmtCost).toBeCloseTo(347_480, 6);
    expect(r.camAnnual).toBe(43_200);
    expect(r.tax).toBeCloseTo(59_752.5, 6);
    expect(r.netIncome).toBeCloseTo(418_267.5, 6);
    expect(r.grossYieldPct).toBeCloseTo(8.687, 3);
    expect(r.netYieldPct).toBeCloseTo(4.182675, 3);
    expect(r.paybackYears).toBeCloseTo(10_000_000 / 418_267.5, 4);
    expect(r.exitValue5yr).toBeCloseTo(10_000_000 * 1.06 ** 5, 2);

    const sum =
      r.mgmtCost + r.camAnnual + r.tax + r.netIncome - r.grossIncome;
    expect(Math.abs(sum)).toBeLessThan(0.01);
  });

  it("handles zero gross income without NaN bar fractions", () => {
    const r = computeCalcStr({
      price: 1,
      sqm: 45,
      adr: 0,
      occPct: 50,
      mgmtPctOfGross: 40,
      camPerSqmMonth: 80,
      appreciationPct: 0,
    });
    expect(r.barFrac.mgmt + r.barFrac.cam + r.barFrac.tax + r.barFrac.net).toBe(
      0,
    );
  });
});
