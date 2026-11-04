import { createHash } from "node:crypto";
import { canonicalJson, type CvConfig } from "./config";

/** Server-only. SHA-256 of the canonical configuration, used to detect edits. The OFFICIAL published fingerprint is computed by the database. */
export function configHash(c: CvConfig): string {
  return createHash("sha256").update(canonicalJson(c)).digest("hex");
}
export const shortHash = (h: string) => h.slice(0, 12);
