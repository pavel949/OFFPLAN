import { describe, expect, it } from "vitest";
import { lintLegalSafe } from "./language";
import * as C from "./public-content";

describe("public methodology copy", () => {
  it("passes our own legal-safe language filter", () => {
    const text = JSON.stringify(C);
    expect(lintLegalSafe(text)).toEqual([]);
  });
  it("lists all ten stop conditions", () => {
    expect(C.GATES_PUBLIC).toHaveLength(10);
  });
  it("contains no weights, thresholds or numeric parameters of the formula", () => {
    const text = JSON.stringify(C).replace(/49\s?%/g, ""); // 49% is the statutory foreign quota, not a model parameter
    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).not.toMatch(/37[.,]5|0[.,]25|\b92\b|\b80\b/);
    expect(text).not.toMatch(/вес[а-я]*\s+\d/i);
  });
  it("describes importance only in coarse classes", () => {
    for (const d of C.DOMAIN_PUBLIC) expect(["очень высокая", "высокая", "средняя", "дополнительная"]).toContain(d.importance);
  });
});
