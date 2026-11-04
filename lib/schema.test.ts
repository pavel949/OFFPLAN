import { describe, expect, it } from "vitest";
import rawProjects from "@/data/seed/projects.json";
import { catalogProjectsSchema, catalogProjectSchema, parseCatalogRows } from "./schema";

describe("catalogue schema", () => {
  it("accepts every seed project (taxonomy drift guard)", () => {
    const r = catalogProjectsSchema.safeParse(rawProjects);
    if (!r.success) {
      throw new Error(JSON.stringify(r.error.issues.slice(0, 5), null, 2));
    }
    expect(r.data.length).toBeGreaterThan(100);
  });

  it("rejects free-text taxonomy values and out-of-range scores", () => {
    const base = (rawProjects as unknown[])[0] as Record<string, unknown>;
    expect(catalogProjectSchema.safeParse({ ...base, zone: "Bangtao" }).success).toBe(true); // any location is allowed
    expect(catalogProjectSchema.safeParse({ ...base, zone: "" }).success).toBe(false);
    expect(catalogProjectSchema.safeParse({ ...base, risk: 5 }).success).toBe(false);
    expect(catalogProjectSchema.safeParse({ ...base, rat: 11 }).success).toBe(false);
    expect(catalogProjectSchema.safeParse({ ...base, dt: "" }).success).toBe(false);
    expect(catalogProjectSchema.safeParse({ ...base, rec: "SELL" }).success).toBe(false);
  });

  it("read path skips only the invalid rows", () => {
    const rows = rawProjects as unknown[];
    const bad = { ...(rows[0] as object), rat: 99 };
    const seen: number[] = [];
    const out = parseCatalogRows([rows[1], bad, rows[2]], (i) => seen.push(i));
    expect(out).toHaveLength(2);
    expect(seen).toEqual([1]);
  });
});
