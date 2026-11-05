import { describe, expect, it } from "vitest";
import { effectiveStatus, legalTopicSummary } from "./countries";
import { COUNTRY_ROLLOUT, LEGAL_TOPICS } from "./country-content";
import { GEO } from "./geo-seed";

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

describe("country preparation copy", () => {
  it("describes Vietnam specialist reviews as planned rather than already underway", () => {
    const vietnam = GEO.find((country) => country.code === "VN")!;
    expect(vietnam.status).toBe("launching");
    expect(vietnam.blurb).toContain("запланированы");
    expect(vietnam.blurb).not.toContain("ведутся с местными специалистами");
  });

  it("does not claim the rollout checklist has already sent topics to a lawyer", () => {
    const legalReview = COUNTRY_ROLLOUT.find((step) => step.t === "Юридический обзор")!;
    expect(legalReview.d).toContain("Предстоит");
    expect(legalReview.d).not.toContain("переданы местному юристу");
  });

  it("neutralizes legacy planned Vietnam summaries without changing stored status or reviewer", () => {
    const topic = { ...base, country: "VN" as const, status: "planned" as const, summary: "Раздел готовится вместе с местным юристом." };
    expect(legalTopicSummary(topic)).toBe("В планах: подготовить материалы по этой теме и передать их на юридическую проверку.");
    expect(topic.summary).toBe("Раздел готовится вместе с местным юристом.");
    expect(topic.status).toBe("planned");
    expect(topic.reviewedBy).toBeNull();
  });

  it.each(["draft", "in_review", "verified", "outdated"] as const)("preserves %s Vietnam topic content", (status) => {
    const topic = { ...base, country: "VN" as const, status, summary: "Сведения с указанным статусом проверки." };
    expect(legalTopicSummary(topic)).toBe(topic.summary);
  });

  it("does not change other countries' planned content", () => {
    const topic = { ...base, status: "planned" as const };
    expect(legalTopicSummary(topic)).toBe(topic.summary);
  });
});
