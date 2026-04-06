import { describe, expect, it } from "vitest";
import { diffJsonObjects } from "./json-diff";

describe("diffJsonObjects", () => {
  it("detects scalar changes", () => {
    const rows = diffJsonObjects({ a: 1, b: "x" }, { a: 2, b: "x" });
    expect(rows.some((r) => r.path === "a")).toBe(true);
  });

  it("returns empty when equal", () => {
    const rows = diffJsonObjects({ n: "x" }, { n: "x" });
    expect(rows.length).toBe(0);
  });
});
