import { freshnessOf } from "./inventory/freshness";
import type { CatalogProject } from "./types";

/** Editorial BUY/WATCH/AVOID labels are published only when explicitly enabled. */
export function showRecLabels(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PROJECT_REC === "true";
}

/**
 * Strip editorial opinion from rows that go to anonymous visitors unless labels are enabled.
 * Done server-side because props of client components are serialised into the HTML.
 */
export function toPublicProject(p: CatalogProject, show = showRecLabels()): CatalogProject {
  const out: CatalogProject = show ? { ...p } : { ...p, rec: "WATCH", recText: "" };
  // Strip at the server boundary, not just in CSS: stale values must not reach
  // client-side filters, analytics or serialized React props.
  if (freshnessOf(p.dataConfirmedAt) === "expired") {
    out.pN = 0;
    out.pT = "POA";
    out.pU = "";
    out.sqmP = "";
  }
  return out;
}
