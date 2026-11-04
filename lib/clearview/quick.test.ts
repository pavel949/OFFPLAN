import { describe, expect, it } from "vitest";
import { CLEARVIEW_V22 } from "./config";
import { runQuick } from "./quick";

const good = { title: "chanote", encumbrance: "none", owner: "same", quota: "low", permit: "yes", eia: "ok", escrow: "escrow", frontload: "low", track: "yes", audit: "yes", loan: "drawn", progress: "yes", penalty: "yes", rental: "none" };
const dev = { respondent: "developer" as const, stage: "mid" as const };

describe("quick self-check", () => {
  it("covers every question with a stable id and an 'unknown' or complete option set", () => {
    expect(CLEARVIEW_V22.quick.length).toBe(14);
    for (const q of CLEARVIEW_V22.quick) expect(q.options.length).toBeGreaterThanOrEqual(2);
  });

  it("a fully clean self-declared project is capped below GOLD: claims are not evidence", () => {
    const r = runQuick(good, dev);
    expect(r.blocked).toBe(false);
    expect(["SILVER"]).toContain(r.tierRange.high);
    expect(r.coverage).toBe("high");
  });

  it("a hard-fail answer blocks the result and names the reason", () => {
    const r = runQuick({ ...good, title: "sorkor1" }, dev);
    expect(r.blocked).toBe(true);
    expect(r.tierRange).toEqual({ low: "REJECT", high: "REJECT" });
    expect(r.flags.map((f) => f.gate)).toEqual(["G2"]);
  });

  it("unanswered questions widen the range instead of guessing", () => {
    const r = runQuick({ title: "chanote" }, dev);
    expect(r.coverage).toBe("low");
    expect(r.answered).toBe(1);
    const full = runQuick(good, dev);
    const order = ["REJECT", "CAUTION", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const width = (x: typeof r) => order.indexOf(x.tierRange.high) - order.indexOf(x.tierRange.low);
    expect(width(r)).toBeGreaterThanOrEqual(width(full));
  });

  it("a buyer's answers (second-hand) are weighed below a developer's own claims", () => {
    const order = ["REJECT", "CAUTION", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const d = runQuick(good, dev), b = runQuick(good, { respondent: "buyer", stage: "mid" });
    expect(order.indexOf(b.tierRange.high)).toBeLessThanOrEqual(order.indexOf(d.tierRange.high));
  });

  it("returns only public-safe data: no composite, weights or item numbers", () => {
    const r = runQuick({ ...good, escrow: "developer", frontload: "high", audit: "no" }, dev);
    const json = JSON.stringify(r);
    for (const leak of ["composite", "weight", "residual", "\"P\"", "\"S\"", "\"O\"", "base"]) expect(json).not.toContain(leak);
    expect(Object.keys(r).sort()).toEqual(["answered", "blocked", "coverage", "domains", "flags", "nextSteps", "note", "tierRange", "total"]);
    for (const d of r.domains) expect([1, 2, 3, 4, 5]).toContain(d.level);
    for (const s of r.nextSteps) expect(["high", "medium", "low"]).toContain(s.impact);
  });

  it("proposes concrete next steps ordered by impact for the risks that were answered", () => {
    const r = runQuick({ ...good, escrow: "developer", frontload: "high", audit: "no" }, dev);
    expect(r.nextSteps.length).toBeGreaterThan(0);
    expect(r.nextSteps.length).toBeLessThanOrEqual(5);
    expect(r.nextSteps.some((s) => /эскроу|гарантию/i.test(s.text))).toBe(true);
  });
});
