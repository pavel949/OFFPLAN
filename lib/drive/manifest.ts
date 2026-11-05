import { isExcel, isImportable, type DriveFile } from "./pick";

export type DriveMaterial = {
  fileId: string;
  name: string;
  path: string;
  mimeType: string;
  sourceUrl: string;
  sourceModifiedAt: string | null;
  sizeBytes: string | null;
  kind: "inventory" | "spreadsheet" | "document" | "image" | "video" | "shortcut" | "other";
  contentStatus: "inventory_preview_available" | "not_extracted";
  reviewStatus: "pending";
  publicationAllowed: false;
};

/** Classify MIME metadata, never infer project facts or publication rights from filenames. */
export function materialManifest(files: DriveFile[]): DriveMaterial[] {
  return files.map((f) => {
    const inventory = isImportable(f);
    const kind: DriveMaterial["kind"] = inventory ? "inventory"
      : isExcel(f) ? "spreadsheet"
      : f.mimeType === "application/vnd.google-apps.shortcut" ? "shortcut"
      : f.mimeType.startsWith("image/") ? "image"
      : f.mimeType.startsWith("video/") ? "video"
      : ["application/pdf", "application/msword", "application/vnd.google-apps.document",
        "application/vnd.google-apps.presentation", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"].includes(f.mimeType) ? "document"
      : "other";
    return {
      fileId: f.id, name: f.name, path: f.path ?? f.name, mimeType: f.mimeType,
      sourceUrl: `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`,
      sourceModifiedAt: f.modifiedTime || null, sizeBytes: f.size ?? null, kind,
      contentStatus: inventory ? "inventory_preview_available" : "not_extracted",
      reviewStatus: "pending", publicationAllowed: false,
    };
  });
}
