import { describe, expect, it } from "vitest";
import { effectiveStatus } from "./countries";
import { LEGAL_TOPICS } from "./country-content";

const base = LEGAL_TOPICS[0];
describe("legal topic status", () => {
  it("a verified topic past its validity date counts as outdated", () => {
    const t = { ...base, status: "verified" as const, reviewedBy: "Lawyer", reviewedAt: "2026-01-01", validUntil: "2026-06-01" };
    expect(effectiveStatus(t, new Date("2026-11-04"))).toBe("outdated");
    expect(effectiveStatus(t, new Date("2026-03-01"))).toBe("verified");
  });
  it("no seeded topic claims to be verified without a reviewer", () => {
    for (const t of LEGAL_TOPICS) if (t.status === "verified") expect(t.reviewedBy).toBeTruthy();
  });
  it("Thailand and Vietnam both have topics", () => {
    expect(LEGAL_TOPICS.some((t) => t.country === "TH")).toBe(true);
    expect(LEGAL_TOPICS.some((t) => t.country === "VN")).toBe(true);
  });
});
