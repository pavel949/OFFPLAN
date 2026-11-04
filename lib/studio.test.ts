import { describe, expect, it } from "vitest";
import seed from "../data/seed/projects.json";
import { catalogProjectSchema } from "./schema";
import { completeness, mergeStudioFields, parseTags, parseYieldMid, studioFieldsSchema } from "./studio";

const base = catalogProjectSchema.parse((seed as unknown[])[0]);

function fieldsOf(p: typeof base, over: Record<string, unknown> = {}) {
  return studioFieldsSchema.parse({
    n: p.n, stK: p.stK, seg: p.seg, type: p.type, compY: p.compY, compQ: p.compQ, priceFromM: p.pN,
    pU: p.pU, sqmP: p.sqmP, units: p.units, unitSzM2: p.unitSzM2, minBR: p.minBR, beach: p.beach, own: p.own,
    mgmt: p.mgmt, focus: p.focus, yield: p.yield, desc: p.desc, src: p.src, tags: p.tags.join(", "),
    rat: p.rat, risk: p.risk, rec: p.rec, recText: p.recText, ...over,
  });
}

describe("studio", () => {
  it("round-trips an untouched project without changing it", () => {
    const merged = mergeStudioFields(base, fieldsOf(base), { dev: base.dev, dt: base.dt, zone: base.zone });
    expect(merged).toEqual(base);
  });

  it("keeps the price label unless the price changed", () => {
    const poa = { ...base, pT: "POA" };
    expect(mergeStudioFields(poa, fieldsOf(poa), { dev: base.dev, dt: base.dt, zone: base.zone }).pT).toBe("POA");
    const changed = mergeStudioFields(base, fieldsOf(base, { priceFromM: 12.5 }), { dev: base.dev, dt: base.dt, zone: base.zone });
    expect(changed.pN).toBe(12.5);
    expect(changed.pT).toBe("฿12.5M+");
  });

  it("applies developer and location links and recomputes the yield midpoint", () => {
    const m = mergeStudioFields(base, fieldsOf(base, { yield: "6-8%" }), { dev: "New Dev", dt: "NEWDEV", zone: "Kata" });
    expect(m.dev).toBe("New Dev");
    expect(m.dt).toBe("NEWDEV");
    expect(m.zone).toBe("Kata");
    expect(m.yN).toBe(7);
  });

  it("rejects bad input with a readable message", () => {
    expect(studioFieldsSchema.safeParse({ ...fieldsOf(base), n: "x" }).success).toBe(false);
    expect(studioFieldsSchema.safeParse({ ...fieldsOf(base), compY: 1800 }).success).toBe(false);
  });

  it("parses tags and yields", () => {
    expect(parseTags("a, b;c\n d ,")).toEqual(["a", "b", "c", "d"]);
    expect(parseYieldMid("~7%")).toBe(7);
    expect(parseYieldMid("н/д")).toBe(0);
  });

  it("scores completeness", () => {
    const empty = completeness({ hasDeveloper: false, hasLocation: false, descLength: 0, hasSource: false, priceKnown: false, units: 0, photos: 0, links: 0, news: 0 });
    expect(empty.score).toBe(0);
    const full = completeness({ hasDeveloper: true, hasLocation: true, descLength: 200, hasSource: true, priceKnown: true, units: 5, photos: 3, links: 2, news: 1 });
    expect(full.score).toBe(100);
  });
});
