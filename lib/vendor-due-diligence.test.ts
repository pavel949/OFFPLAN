import { describe, expect, it } from "vitest";
import { canDisplayVendorReport, VENDOR_DUE_DILIGENCE, type VendorPublicationEvidence } from "./vendor-due-diligence";
const now = Date.parse("2026-11-05");
const ready: VendorPublicationEvidence = { projectId: "p", publishedProjectId: "p", publicReportUrl: "https://example.com/report", reportDate: "2026-11-01", expiresAt: "2026-12-01", scopePublished: true, limitationsPublished: true, findingsPublished: true, reviewerIdentified: true, independenceReviewed: true, commissioningDeveloperDisclosed: true, publicationApproved: true };
describe("developer-commissioned independent review boundaries", () => {
  it("sets the requested price without claiming checkout or tax terms", () => {
    expect(VENDOR_DUE_DILIGENCE.priceTHB).toBe(49000);
    expect(VENDOR_DUE_DILIGENCE.checkoutAvailable).toBe(false);
    expect(VENDOR_DUE_DILIGENCE.taxStatus).toBe("to_be_agreed");
  });
  it("only allows a complete current project-specific public report", () => {
    expect(canDisplayVendorReport(ready, now)).toBe(true);
    expect(canDisplayVendorReport(null, now)).toBe(false);
    expect(canDisplayVendorReport({ ...ready, publishedProjectId: "other" }, now)).toBe(false);
  });
  it.each(["scopePublished", "limitationsPublished", "findingsPublished", "reviewerIdentified", "independenceReviewed", "commissioningDeveloperDisclosed", "publicationApproved"] as const)("requires %s regardless of commercial status", key => {
    expect(canDisplayVendorReport({ ...ready, [key]: false }, now)).toBe(false);
  });
  it.each(["2026-11-05", "2026-01-01", "invalid"])("rejects expired or invalid expiry %s", expiresAt => {
    expect(canDisplayVendorReport({ ...ready, expiresAt }, now)).toBe(false);
  });
  it.each(["http://example.com", "javascript:alert(1)", "https://user:pass@example.com"])("rejects unsafe report link %s", publicReportUrl => {
    expect(canDisplayVendorReport({ ...ready, publicReportUrl }, now)).toBe(false);
  });
  it("rejects future-dated reports", () => expect(canDisplayVendorReport({ ...ready, reportDate: "2026-11-06" }, now)).toBe(false));
});
