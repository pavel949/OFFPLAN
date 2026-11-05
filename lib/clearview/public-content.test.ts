import { describe, expect, it } from "vitest";
import { lintLegalSafe } from "./language";
import * as C from "./public-content";

describe("public methodology copy", () => {
  it("passes our own legal-safe language filter", () => {
    const text = JSON.stringify(C);
    expect(lintLegalSafe(text)).toEqual([]);
  });
  it("lists all ten stop conditions", () => {
    expect(C.GATES_PUBLIC).toHaveLength(10);
  });
  it("contains no weights, thresholds or numeric parameters of the formula", () => {
    const text = JSON.stringify(C).replace(/49\s?%/g, ""); // 49% is the statutory foreign quota, not a model parameter
    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).not.toMatch(/37[.,]5|0[.,]25|\b92\b|\b80\b/);
    expect(text).not.toMatch(/вес[а-я]*\s+\d/i);
  });
  it("describes importance only in coarse classes", () => {
    for (const d of C.DOMAIN_PUBLIC) expect(["очень высокая", "высокая", "средняя", "дополнительная"]).toContain(d.importance);
  });
});

import { assess, type AssessmentInput } from "./engine";
import { CLEARVIEW_V22 } from "./config";
import { CLEARVIEW_SERVICES } from "./services";

describe("public explanation matches implemented boundaries", () => {
  const input: AssessmentInput = { scope: { stage: "early" }, items: {} };
  it("describes every engine result state without granting a level to missing gates", () => {
    expect(C.ASSESSMENT_STATES_PUBLIC.map(s => s.key).sort()).toEqual(["incomplete", "rated", "rejected"]);
    const incomplete = assess(input, CLEARVIEW_V22);
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.tier).toBeNull();
    expect(incomplete.composite).toBeNull();
    const rejected = assess({ ...input, gates: { G1: "triggered" } }, CLEARVIEW_V22);
    expect(rejected.status).toBe("rejected");
    expect(rejected.composite).toBeNull();
  });
  it("keeps three distinct service paths and unpriced services unpriced", () => {
    expect(CLEARVIEW_SERVICES.map(s => s.id)).toEqual(["sales", "developer", "buyer"]);
    expect(CLEARVIEW_SERVICES[1].price).toMatch(/49\s000 THB/);
    expect(CLEARVIEW_SERVICES[2].price).toBe("Цена после согласования задания");
    expect(CLEARVIEW_SERVICES[1].monitoring).toContain("пока не подключены");
    expect(CLEARVIEW_SERVICES[1].description).toContain("расходы третьих лиц и сроки согласуются до заказа");
  });
  it("identifies our team and bounds the approved partner role", () => {
    expect(C.GOVERNANCE.join(" ")).toContain("AV Group — партнёр рейтинга ClearView");
    expect(C.GOVERNANCE.join(" ")).toContain("Оценку и итоговое решение принимает команда Ignatev Estate");
    expect(C.GOVERNANCE.join(" ")).not.toContain("отдельное юридическое лицо");
  });
});
