import { describe, expect, it } from "vitest";
import { BENCHMARKS } from "./benchmarks";
import { ATLAS_V21, CLEARVIEW_V22 } from "./config";
import { assess } from "./engine";

const run = (cfg = CLEARVIEW_V22) => Object.fromEntries(BENCHMARKS.map((b) => [b.id, assess(b.build(cfg), cfg)]));

describe("benchmarks (synthetic reference projects)", () => {
  it("rank sensibly under the corrected scale: verified > claimed > typical > opaque", () => {
    const r = run();
    const c = (id: string) => r[id].composite!;
    expect(c("verified_clean")).toBeGreaterThan(c("claimed_clean"));
    expect(c("claimed_clean")).toBeGreaterThan(c("typical_mid"));
    expect(c("typical_mid")).toBeGreaterThan(c("opaque"));
  });
  it("a stalled, unfunded project averages out at SILVER in the Atlas but is held at CAUTION by the weak-domain ceilings", () => {
    expect(run(ATLAS_V21).risky.tier).toBe("SILVER");
    const r = run().risky;
    expect(r.tier).toBe("CAUTION");
    expect(r.capsApplied.some((c) => /overall capped/.test(c))).toBe(true);
  });
  it("a triggered gate rejects regardless of everything else", () => {
    expect(run().gate_sorkor1).toMatchObject({ status: "rejected", tier: "REJECT" });
  });
  it("the corrected scale makes PLATINUM reachable and keeps an unverified project below GOLD", () => {
    expect(run().verified_clean.tier).toBe("PLATINUM");
    expect(["PLATINUM", "GOLD"]).not.toContain(run().claimed_clean.tier);
  });
  it("under the published Atlas scale PLATINUM is not reachable (documented defect)", () => {
    expect(run(ATLAS_V21).verified_clean.tier).toBe("GOLD");
  });
  it("covers a complete scope: every benchmark is rated or explicitly rejected, never left incomplete", () => {
    for (const x of Object.values(run())) expect(["rated", "rejected"]).toContain(x.status);
  });
});
