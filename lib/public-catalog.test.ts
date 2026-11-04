import { describe, expect, it } from "vitest";
import rawProjects from "@/data/seed/projects.json";
import { toPublicProject } from "./public-catalog";
import type { CatalogProject } from "./types";

const p = (rawProjects as unknown as CatalogProject[]).find((x) => x.rec === "AVOID")!;

describe("toPublicProject", () => {
  it("removes editorial labels when disabled", () => {
    const out = toPublicProject(p, false);
    expect(out.rec).toBe("WATCH");
    expect(out.recText).toBe("");
    expect(out.n).toBe(p.n);
  });
  it("keeps them when enabled", () => {
    expect(toPublicProject(p, true).rec).toBe("AVOID");
  });
});


describe("public price freshness", () => {
  it("strips unconfirmed, invalid, future and expired prices before serialization", () => {
    for (const date of [null, "invalid", "2999-01-01", "2020-01-01"]) {
      const out = toPublicProject({ ...p, dataConfirmedAt: date });
      expect(out).toMatchObject({ pN: 0, pT: "POA", pU: "", sqmP: "" });
    }
  });
  it("preserves recently confirmed prices without mutating the original", () => {
    const row = { ...p, dataConfirmedAt: new Date().toISOString() };
    expect(toPublicProject(row).pN).toBe(p.pN);
    expect(toPublicProject(row).pT).toBe(p.pT);
    expect(row.rec).toBe(p.rec);
  });
});
