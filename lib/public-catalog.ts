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
  if (show) return p;
  return { ...p, rec: "WATCH", recText: "" };
}
