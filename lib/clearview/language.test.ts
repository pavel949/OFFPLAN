import { describe, expect, it } from "vitest";
import { lintLegalSafe } from "./language";

describe("legal-safe language filter", () => {
  it("flags guaranteed returns, capital protection, fund wording and safety claims in English", () => {
    const rules = lintLegalSafe("Guaranteed return of 8%. Your capital protected. Invest in our investment fund: a safe investment.").map((i) => i.rule);
    expect(rules).toEqual(expect.arrayContaining(["guaranteed return", "capital protection", "investment fund", "safe investment"]));
  });
  it("flags the same claims in Russian", () => {
    const rules = lintLegalSafe("Гарантированный доход 9% годовых, безопасная инвестиция, инвестиционный фонд.").map((i) => i.rule);
    expect(rules).toEqual(expect.arrayContaining(["guaranteed return", "safe investment", "investment fund"]));
  });
  it("accepts the recommended wording", () => {
    expect(lintLegalSafe("Projected rental yield of 6 to 8% under the stated occupancy scenario. Developer-offered return programme: see the issuer's financial capacity in section 5.")).toEqual([]);
    expect(lintLegalSafe("Ожидаемая доходность по сценарию аренды: 6–8% при заполняемости 70%.")).toEqual([]);
  });
});
