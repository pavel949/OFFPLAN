import { describe, it, expect } from "vitest";
import {
  evidenceSchema,
  operatingCostTotals,
  type ProjectEvidence,
} from "./project-evidence";
const base = {
  project_id: "00000000-0000-4000-8000-000000000001",
  fact_key: "cam",
  title: "CAM",
  source_url: "https://developer.example/fees",
  observed_at: "2026-01-01",
  details: { amount: 80, currency: "THB", basis: "sqm", period: "month" },
  kind: "operating_cost",
};
describe("sourced project facts", () => {
  it("rejects insecure media, negative costs, impossible sales totals and future observations", () => {
    expect(
      evidenceSchema.safeParse({ ...base, source_url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({
        ...base,
        details: { ...base.details, amount: -1 },
      }).success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({
        ...base,
        kind: "photo",
        details: { url: "data:text/html,x", caption: "X" },
      }).success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({
        ...base,
        kind: "sales",
        details: { stage: "launch", total_units: 0 },
      }).success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({ ...base, observed_at: "2099-01-01" }).success,
    ).toBe(false);
  });
  it("keeps currencies and one-off costs separate; unknown area never becomes zero", () => {
    const f = {
      ...base,
      id: "x",
      status: "published",
      reviewed_at: "2026-01-01",
    } as ProjectEvidence;
    const once = {
      ...f,
      details: { amount: 500, currency: "THB", basis: "sqm", period: "once" },
    };
    expect(operatingCostTotals([f, once], 45)).toEqual([
      { currency: "THB", annual: 43200, once: 22500, needsArea: false },
    ]);
    expect(operatingCostTotals([f], null)).toEqual([
      { currency: "THB", annual: 0, once: 0, needsArea: true },
    ]);
    expect(operatingCostTotals([{ ...f, status: "pending" }], 45)).toEqual([]);
  });
});
