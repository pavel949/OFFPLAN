import { describe, expect, it } from "vitest";
import { effectiveLevel, levelLabel } from "./levels";

describe("effectiveLevel", () => {
  const now = Date.parse("2026-11-30T00:00:00Z");
  it("returns the level while valid and 0 once expired", () => {
    expect(effectiveLevel({ level: 2, verifiedAt: "2026-01-01T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" }, now)).toBe(2);
    expect(effectiveLevel({ level: 1, verifiedAt: "2025-01-01T00:00:00Z", expiresAt: "2026-01-01T00:00:00Z" }, now)).toBe(0);
  });
  it("treats missing or malformed data as unverified", () => {
    expect(effectiveLevel(null, now)).toBe(0);
    expect(effectiveLevel({ level: 1, verifiedAt: null, expiresAt: null }, now)).toBe(0);
    expect(effectiveLevel({ level: 1, verifiedAt: null, expiresAt: "garbage" }, now)).toBe(0);
  });
  it("labels in both languages", () => {
    expect(levelLabel(1, "ru")).toBe("Документы проверены");
    expect(levelLabel(2, "en", true)).toBe("L2 · independent");
  });
});

import { registryError } from "./errors";

describe("registryError", () => {
  it("translates database rule violations", () => {
    expect(registryError("four-eyes rule: the final decision must be taken by a different reviewer")).toContain("четырёх глаз");
    expect(registryError("conflict of interest: recuse")).toContain("Конфликт интересов");
    expect(registryError("duplicate key value violates unique constraint \"verification_cases_one_open\"")).toContain("уже есть открытая заявка");
    expect(registryError("something else")).toBe("something else");
  });
});
