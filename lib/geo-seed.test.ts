import { describe, expect, it } from "vitest";
import { GEO } from "./geo-seed";
import { slugify } from "./slug";

describe("geo seed integrity", () => {
  const all = GEO.flatMap((c) => c.regions.flatMap((r) => [{ c: c.code, slug: r.slug, name: r.en }, ...r.locations.map((l) => ({ c: c.code, slug: l.slug, name: l.en }))]));
  it("slugs are unique across the whole seed (they are used in global URLs)", () => {
    const seen = new Set<string>();
    for (const x of all) {
      expect(seen.has(x.slug), `duplicate slug ${x.slug}`).toBe(false);
      seen.add(x.slug);
    }
  });
  it("location slug equals the slug of its English name, so project `zone` values resolve to the page", () => {
    // Exceptions are locations whose English display name is intentionally composite: slug is explicit.
    const bad = GEO.flatMap((c) => c.regions.flatMap((r) => r.locations)).filter((l) => slugify(l.en) !== l.slug && !/&/.test(l.en) && !/District/.test(l.en));
    expect(bad.map((b) => b.slug)).toEqual([]);
  });
  it("covers the requested destinations", () => {
    const regions = GEO.flatMap((c) => c.regions.map((r) => r.slug));
    for (const s of ["phuket", "bangkok", "pattaya", "hua-hin", "ho-chi-minh-city", "da-nang"]) expect(regions).toContain(s);
    expect(GEO.find((c) => c.code === "VN")!.regions.length).toBeGreaterThanOrEqual(4);
  });
  it("every country has ISO code and status", () => {
    for (const c of GEO) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(["active", "launching", "planned"]).toContain(c.status);
    }
  });
});
