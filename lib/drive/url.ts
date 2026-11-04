/** Recognise Google Drive / Docs links and extract the object id. Everything else returns null. */
export type DriveRef = { kind: "folder" | "file" | "sheet"; id: string };

const ID = "[A-Za-z0-9_-]{10,}";

export function parseDriveUrl(raw: string): DriveRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host === "drive.google.com") {
    const folder = path.match(new RegExp(`/folders/(${ID})`));
    if (folder) return { kind: "folder", id: folder[1] };
    const file = path.match(new RegExp(`/file/d/(${ID})`));
    if (file) return { kind: "file", id: file[1] };
    if (path === "/open" || path === "/drive/folders") {
      const id = u.searchParams.get("id");
      if (id && new RegExp(`^${ID}$`).test(id)) return { kind: "file", id };
    }
    return null;
  }
  if (host === "docs.google.com") {
    const sheet = path.match(new RegExp(`/spreadsheets/d/(${ID})`));
    if (sheet) return { kind: "sheet", id: sheet[1] };
  }
  return null;
}
