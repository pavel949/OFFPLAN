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
