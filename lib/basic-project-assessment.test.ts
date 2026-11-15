import { describe, expect, it } from "vitest";
import { basicProjectAssessment } from "./basic-project-assessment";
import type { ProjectEvidence } from "./project-evidence";
import type { PublicSource } from "./sources";
const now = Date.parse("2026-11-05T12:00:00Z");
const f: ProjectEvidence = { id: "f", project_id: "p", kind: "sales", fact_key: "sale", title: "Sales stage", source_url: "https://example.com/source", observed_at: "2026-11-01", reviewed_at: "2026-11-02T10:00:00Z", status: "published", details: {} };
const s = { id: "s", project_id: "p", kind: "legal_docs", title: "Documents", url: "https://example.com/docs", confirmed_at: "2026-11-03", cadence: "none" } as PublicSource;
const input = { projectId: "p", facts: [f], sources: [s], error: false, now };
describe("basic project evidence summary", () => {
  it("records only scoped published facts with valid reviewed dates, not a rating", () => {
    const r = basicProjectAssessment(input);
    expect(r.status).toBe("review_records_available");
    expect(r.reviewedFacts).toHaveLength(1);
    expect(r).not.toHaveProperty("score");
    expect(r.topics.every(t => t.status === "review_not_established")).toBe(true);
    expect(r.topics.find(t => t.id === "land")?.sources).toHaveLength(1);
    expect(r.topics.find(t => t.id === "price")?.sources).toHaveLength(0);
  });
  it.each([null, "", "invalid", "2027-01-01", "2026-10-01"])("does not treat reviewed_at %s as reviewed evidence", reviewed_at => {
    const r = basicProjectAssessment({ ...input, facts: [{ ...f, reviewed_at }] });
    expect(r.reviewedFacts).toHaveLength(0);
    expect(r.unreviewedFacts).toHaveLength(1);
  });
  it.each(["invalid", "2027-01-01"])("rejects invalid or future source dates %s", observed_at => {
    expect(basicProjectAssessment({ ...input, facts: [{ ...f, observed_at }] }).reviewedFacts).toHaveLength(0);
  });
  it("never leaks private, cross-project or unsafe-link entries", () => {
    const r = basicProjectAssessment({ ...input, facts: [{ ...f, status: "draft" }, { ...f, project_id: "other" }, { ...f, source_url: "javascript:alert(1)" }], sources: [{ ...s, project_id: "other" }, { ...s, url: "https://user:pass@example.com/" }] });
    expect(r.status).toBe("no_evidence");
    expect(r.reviewedFacts).toEqual([]);
    expect(r.unreviewedFacts).toEqual([]);
    expect(r.topics.every(t => t.sources.length === 0)).toBe(true);
  });
  it("distinguishes load failure, missing evidence and unreviewed sources", () => {
    expect(basicProjectAssessment({ ...input, error: true }).status).toBe("unavailable");
    expect(basicProjectAssessment({ ...input, projectId: null }).status).toBe("no_evidence");
    expect(basicProjectAssessment({ ...input, facts: [] }).status).toBe("sources_only");
  });
});
