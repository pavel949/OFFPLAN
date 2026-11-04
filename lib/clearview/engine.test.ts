import { describe, expect, it } from "vitest";
import { adjustWeights, assess, fromState, tierOf, whatIf, type AssessmentInput, type EvidenceClass } from "./engine";
import { DOMAINS, GATE_TEXT, ITEMS, type Gate } from "./registry";

const GATES_NO_STR = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"] as const;
const allClear = Object.fromEntries(GATES_NO_STR.map((g) => [g, "clear"])) as AssessmentInput["gates"];
const scope = { stage: "early" as const };

function uniform(state: "absent" | "present" | "unknown", ev: EvidenceClass, extra: Partial<AssessmentInput> = {}): AssessmentInput {
  const items: AssessmentInput["items"] = {};
  for (const it of ITEMS) items[it.code] = fromState(it, state, ev);
  return { scope, items, gates: allClear, ...extra };
}

describe("registry integrity (Atlas v2.1 appendix)", () => {
  it("lists 56 items although the Atlas text says 57: one item is missing from the document", () => {
    expect(ITEMS).toHaveLength(56);
  });
  it("base weights sum to 100% and every domain has items", () => {
    expect(DOMAINS.reduce((s, d) => s + d.base, 0)).toBeCloseTo(1, 10);
    for (const d of DOMAINS) expect(ITEMS.some((i) => i.domain === d.code)).toBe(true);
  });
  it("feeds each of the 10 hard-fail gates from exactly one item", () => {
    for (const g of Object.keys(GATE_TEXT) as Gate[]) expect(ITEMS.filter((i) => i.gate === g)).toHaveLength(1);
  });
  it("classifies evidence collection: how much can be automated (our proposal)", () => {
    const n = (a: string) => ITEMS.filter((i) => i.auto === a).length;
    expect(n("data") + n("ai") + n("manual")).toBe(56);
    expect(n("data")).toBe(15);
    expect(n("ai")).toBe(18);
    expect(n("manual")).toBe(23);
  });
  it("keeps item codes unique", () => {
    expect(new Set(ITEMS.map((i) => i.code)).size).toBe(ITEMS.length);
  });
});

describe("dynamic weights", () => {
  it("every stage and type modifier nets to zero, as the Atlas claims", () => {
    for (const stage of ["prelaunch", "early", "mid", "late", "completed"] as const) {
      const { weights } = adjustWeights({ stage }, { weightFloorShare: 0 });
      expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });
  it("stacked modifiers drive a weight negative in the Atlas; the floor keeps weights positive", () => {
    // Atlas arithmetic: villa on a company structure (-3 D6), pre-launch (-3 D6), personal-use buyer (-5 D6): 7 - 11 = -4
    const stacked = { stage: "prelaunch" as const, kinds: ["villa_company" as const], buyerProfile: "personal" as const };
    const { weights, floored } = adjustWeights(stacked);
    expect(floored).toContain("D6");
    expect(Math.min(...Object.values(weights))).toBeGreaterThan(0);
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
  it("pre-launch branded residence also hits the floor on D7", () => {
    expect(adjustWeights({ stage: "prelaunch", kinds: ["branded"] }).floored).toContain("D7");
  });
});

describe("worked example in the Bible does not add up", () => {
  it("(88x22 + 58x18 + 81x15 + 91x14 + 62x12 + 79x9 + 71x6 + 76x4) / 100 is 76.5, not the printed 74.0", () => {
    const dom = [88, 58, 81, 91, 62, 79, 71, 76], w = [22, 18, 15, 14, 12, 9, 6, 4];
    expect(dom.reduce((s, v, i) => s + v * w[i], 0) / 100).toBeCloseTo(76.54, 2);
  });
});

describe("gates", () => {
  it("any triggered gate rejects without a composite", () => {
    const r = assess({ ...uniform("absent", "registry"), gates: { ...allClear, G6: "triggered" } });
    expect(r).toMatchObject({ status: "rejected", tier: "REJECT", composite: null });
    expect(r.gatesTriggered).toEqual(["G6"]);
  });
  it("a gate with no evidence leaves the case incomplete instead of rejecting (fairness fix)", () => {
    const r = assess({ ...uniform("absent", "registry"), gates: { ...allClear, G3: "unknown" } });
    expect(r).toMatchObject({ status: "incomplete", tier: null });
    expect(r.gatesUnknown).toEqual(["G3"]);
  });
  it("the Atlas behaviour (missing gate evidence auto-triggers) stays available", () => {
    const r = assess({ ...uniform("absent", "registry"), gates: { ...allClear, G3: "unknown" }, options: { gateUnknown: "auto_trigger" } });
    expect(r.status).toBe("rejected");
  });
  it("G10 applies only to a short-term-rental pool thesis", () => {
    expect(assess({ ...uniform("absent", "registry") }).gatesUnknown).not.toContain("G10");
    expect(assess({ ...uniform("absent", "registry"), scope: { stage: "early", rentalThesis: "str" } }).gatesUnknown).toContain("G10");
  });
});

describe("calibration findings (Atlas formulas as published)", () => {
  it("a perfect, registry-verified project tops out at about 91: PLATINUM (92+) is unreachable", () => {
    const r = assess(uniform("absent", "registry", { facts: { platinum: { eiaConfirmed: true, permitConfirmed: true, quotaUsedPct: 10, escrowActive: true, noCourtAction: true, noFloodRisk: true } } }));
    expect(r.composite).toBeGreaterThan(90);
    expect(r.composite).toBeLessThan(92);
    expect(r.tier).toBe("GOLD");
  });
  it("only misusing the mitigation multiplier on risks that do not exist gets past 92", () => {
    const input = uniform("absent", "registry");
    for (const it of ITEMS) input.items[it.code] = { ...input.items[it.code], M: 0.5 };
    expect(assess(input).composite).toBeGreaterThan(92);
  });
  it("even with every risk confirmed (and no gate flagged) the composite stays at CAUTION, never REJECT", () => {
    const r = assess(uniform("present", "registry"));
    expect(r.composite).toBeGreaterThan(40);
    expect(r.tier).toBe("CAUTION");
  });
  it("no evidence at all (50.7) scores close to every risk confirmed (40.6): little reward for disclosure", () => {
    const none = assess(uniform("unknown", "missing")).composite!;
    const bad = assess(uniform("present", "registry")).composite!;
    expect(none - bad).toBeLessThan(12);
  });
  it("stretched calibration uses the full range: verified-clean 100, everything confirmed bad rejects", () => {
    const stretched = { calibration: "stretched" as const };
    expect(assess(uniform("absent", "registry", { options: stretched })).composite).toBe(100);
    expect(assess(uniform("present", "registry", { options: stretched })).tier).toBe("REJECT");
  });
});

describe("evidence beats claims (the commercial core)", () => {
  it("a project with a clean self-declared package cannot get past SILVER; verification is what unlocks GOLD", () => {
    const claimed = assess(uniform("absent", "developer"));
    const verified = assess(uniform("absent", "registry"));
    expect(claimed.tier).toBe("SILVER");
    expect(verified.tier).toBe("GOLD");
    expect(verified.composite! - claimed.composite!).toBeGreaterThan(12);
  });
  it("what-if: confirming one gate-adjacent item with a registry document lifts the score by a known amount", () => {
    const base = uniform("absent", "developer");
    const delta = whatIf(base, { "3.2": fromState(ITEMS.find((i) => i.code === "3.2")!, "absent", "registry") });
    expect(delta.delta).toBeGreaterThan(0);
  });
});

describe("incomplete data", () => {
  it("low data confidence caps the tier at SILVER and is reported", () => {
    const input = uniform("absent", "registry");
    for (const it of ITEMS.slice(0, 40)) input.items[it.code] = undefined;
    const r = assess(input);
    expect(r.dataConfidence).toBe("low");
    expect(["SILVER", "BRONZE", "CAUTION"]).toContain(r.tier);
  });
  it("maps scores to tiers on the Atlas boundaries", () => {
    expect([100, 92, 91.9, 80, 79.9, 70, 69.9, 60, 59.9, 40, 39.9].map(tierOf)).toEqual([
      "PLATINUM", "PLATINUM", "GOLD", "GOLD", "SILVER", "SILVER", "BRONZE", "BRONZE", "CAUTION", "CAUTION", "REJECT",
    ]);
  });
});
