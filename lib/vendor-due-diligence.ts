/** Product policy only. No checkout, order persistence, reviewer allocation or report
 * publication is implemented by this module. A developer pays for examination, never a grade.
 */
export const VENDOR_DUE_DILIGENCE = {
  priceTHB: 49_000,
  currency: "THB",
  taxStatus: "to_be_agreed",
  checkoutAvailable: false,
  states: ["not_requested", "scope_agreed", "collecting_documents", "independent_review", "awaiting_clarification", "report_ready", "published", "expired", "withdrawn"],
} as const;
export type VendorDueDiligenceState = typeof VENDOR_DUE_DILIGENCE.states[number];
export type VendorPublicationEvidence = {
  projectId: string;
  publishedProjectId: string;
  publicReportUrl: string;
  reportDate: string;
  expiresAt: string;
  scopePublished: boolean;
  limitationsPublished: boolean;
  findingsPublished: boolean;
  reviewerIdentified: boolean;
  independenceReviewed: boolean;
  commissioningDeveloperDisclosed: boolean;
  publicationApproved: boolean;
};

/** Future publication acceptance gate. Only trusted reviewer-controlled records may
 * supply this evidence; developer payloads, payments and dashboard badges cannot.
 * This function does not publish anything or certify legal/financial soundness.
 */
export function canDisplayVendorReport(e: VendorPublicationEvidence | null, now = Date.now()): boolean {
  if (!e || !e.projectId || e.projectId !== e.publishedProjectId) return false;
  let url: URL;
  try { url = new URL(e.publicReportUrl); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || /\s/.test(e.publicReportUrl)) return false;
  const issued = Date.parse(e.reportDate), expires = Date.parse(e.expiresAt);
  return Number.isFinite(issued) && Number.isFinite(expires) && issued <= now && expires > now && expires > issued
    && e.scopePublished && e.limitationsPublished && e.findingsPublished && e.reviewerIdentified
    && e.independenceReviewed && e.commissioningDeveloperDisclosed && e.publicationApproved;
}
