export const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
export const GOOGLE_FOLDER = "application/vnd.google-apps.folder";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
};

const TEXT_MIMES = new Set([
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "application/csv",
]);

/** Files the unit importer can read directly: Google Sheets and CSV/TSV text. */
export function isImportable(f: Pick<DriveFile, "mimeType" | "name">): boolean {
  if (f.mimeType === GOOGLE_SHEET) return true;
  if (TEXT_MIMES.has(f.mimeType)) return true;
  return /\.(csv|tsv)$/i.test(f.name);
}

export function isExcel(f: Pick<DriveFile, "mimeType" | "name">): boolean {
  return (
    f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    f.mimeType === "application/vnd.ms-excel" ||
    /\.xlsx?$/i.test(f.name)
  );
}

const PRICE_WORDS = /(price|прайс|pricelist|inventory|availability|stock|налич|остатк|юнит|unit)/i;

/** Importable files first, price-list-looking names before others, newest first. */
export function rankFiles(files: DriveFile[]): DriveFile[] {
  const score = (f: DriveFile) =>
    (isImportable(f) ? 2 : 0) + (PRICE_WORDS.test(f.name) ? 1 : 0);
  return [...files]
    .filter((f) => f.mimeType !== GOOGLE_FOLDER)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime(),
    );
}
