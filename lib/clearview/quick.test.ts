import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CLEARVIEW_V22 } from "./config";
import { runQuick } from "./quick";

const good = { title: "chanote", encumbrance: "none", owner: "same", quota: "low", permit: "yes", eia: "ok", escrow: "escrow", frontload: "low", track: "yes", audit: "yes", loan: "drawn", progress: "yes", penalty: "yes", cancellation: "yes", rental: "none" };
const dev = { respondent: "developer" as const, stage: "mid" as const };
const steps = (a: Record<string, string>) => runQuick(a, dev).nextSteps.map(s => s.text).join(" ");

describe("quick self-check evidence integrity", () => {
  it("asks about cancellation separately from penalties", () => {
    expect(CLEARVIEW_V22.quick).toHaveLength(15);
    const penalty = CLEARVIEW_V22.quick.find(q => q.id === "penalty")!;
    expect(penalty.options.flatMap(o => o.effects).some(e => e.item === "5.3")).toBe(false);
    expect(steps({ ...good, cancellation: "unknown" })).toContain("право расторжения");
    expect(steps({ ...good, cancellation: "no" })).toContain("право расторжения");
    expect(steps(good)).not.toContain("право расторжения");
  });

  it("never represents self-declarations as a rating, numerical domain level or verified fact", () => {
    for (const respondent of ["developer", "buyer"] as const) {
      const r = runQuick(good, { ...dev, respondent });
      expect(r).not.toHaveProperty("tierRange");
      expect(r.domains.every(d => !("level" in d))).toBe(true);
      expect(r.domains.find(d => d.code === "D7")?.status).toBe("not_assessed");
      expect(r.domains.find(d => d.code === "D1")?.status).toBe("needs_verification");
      expect(r.coverage).toBe("high");
      expect(r.note).toContain("Документы здесь не проверяются");
    }
  });

  it("unknown, skipped and invalid answers have the same low coverage and follow-up", () => {
    const unknown = Object.fromEntries(CLEARVIEW_V22.quick.map(q => [q.id, "unknown"]));
    const invalid = Object.fromEntries(CLEARVIEW_V22.quick.map(q => [q.id, "invalid"]));
    expect(runQuick(unknown, dev)).toEqual(runQuick({}, dev));
    expect(runQuick(invalid, dev)).toEqual(runQuick({}, dev));
    expect(runQuick(unknown, dev).answered).toBe(0);
    expect(runQuick(unknown, dev).coverage).toBe("low");
    expect(runQuick({ title: "chanote" }, dev).answered).toBe(1);
    expect(runQuick({}, dev).nextSteps.length).toBeGreaterThan(0);
  });

  it.each([
    ["escrow", "high", false], ["escrow", "low", false], ["escrow", "unknown", false],
    ["developer", "high", true], ["developer", "low", false], ["developer", "unknown", true],
    ["unknown", "high", true], ["unknown", "low", false], ["unknown", "unknown", true],
  ])("combines payment protection %s and frontload %s without overwrite", (escrow, frontload, needsFollowup) => {
    expect(steps({ ...good, escrow, frontload }).includes("Согласовать эскроу")).toBe(needsFollowup);
    const reversed = { ...CLEARVIEW_V22, quick: [...CLEARVIEW_V22.quick].reverse() };
    const r = runQuick({ ...good, escrow, frontload }, dev, reversed);
    expect(r.nextSteps.map(s => s.text).includes("Согласовать эскроу или банковскую гарантию на платежи покупателей")).toBe(needsFollowup);
  });

  it("does not clear unasked gates or beneficial ownership from owner matching", () => {
    const r = runQuick(good, dev);
    expect(r.unresolvedGates.map(g => g.gate)).toEqual(["G1", "G3"]);
    expect(r.blocked).toBe(false);
    expect(runQuick({}, dev).unresolvedGates).toHaveLength(10);
    expect(runQuick({ ...good, rental: "str_lic" }, dev).unresolvedGates.some(g => g.gate === "G10")).toBe(false);
  });

  it("keeps all reported hard stops first and high priority, including multiple stops", () => {
    const r = runQuick({ ...good, title: "sorkor1", permit: "no", rental: "str_nolic" }, dev);
    expect(r.blocked).toBe(true);
    expect(r.flags.map(f => f.gate)).toEqual(["G2", "G5", "G10"]);
    expect(r.nextSteps.slice(0, 3).every(s => s.impact === "high" && s.text.startsWith("Приоритетная"))).toBe(true);
  });

  it("does not equate prelaunch with a supplied permit", () => {
    expect(steps({ ...good, permit: "prelaunch" })).toContain("копию разрешения");
  });

  it("returns no scoring internals", () => {
    const json = JSON.stringify(runQuick(good, dev));
    for (const leak of ["composite", "weight", "residual", '"P"', '"S"', '"O"', '"level"', "tierRange"]) expect(json).not.toContain(leak);
  });

  it("renders a checklist, not a paid order or rating chart", () => {
    const ui = readFileSync("components/clearview/QuickAssessment.tsx", "utf8");
    for (const absent of ["TierLadder", "<Radar", "LevelBar", "49 000", "Заказать в кабинете", "setTimeout"]) expect(ui).not.toContain(absent);
    expect(ui).toContain("Рейтинг проекта не присваивается");
    expect(ui).toContain("Содержательных ответов");
  });
});
