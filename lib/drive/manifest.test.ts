import { describe, expect, it } from "vitest";
import { materialManifest } from "./manifest";

describe("Drive metadata review manifest", () => {
  it("keeps source evidence without inventing content or publication permission", () => {
    const [entry] = materialManifest([{ id: "a", name: "Guaranteed 10% yield.pdf", path: "Sales/Guaranteed 10% yield.pdf", mimeType: "application/pdf", modifiedTime: "2026-01-01T00:00:00Z", size: "123" }]);
    expect(entry).toMatchObject({ kind: "document", path: "Sales/Guaranteed 10% yield.pdf", sourceUrl: "https://drive.google.com/file/d/a/view", contentStatus: "not_extracted", reviewStatus: "pending", publicationAllowed: false });
    expect(entry).not.toHaveProperty("yield");
  });
  it("never treats a shortcut named CSV as importable inventory", () => {
    const [entry] = materialManifest([{ id: "link", name: "prices.csv", mimeType: "application/vnd.google-apps.shortcut", modifiedTime: "" }]);
    expect(entry.kind).toBe("shortcut");
    expect(entry.contentStatus).toBe("not_extracted");
  });
  it("separates inventory preview, media, unsupported content and shortcuts", () => {
    const mimes = ["text/csv", "image/jpeg", "video/mp4", "application/vnd.google-apps.shortcut", "application/zip"];
    const entries = materialManifest(mimes.map((mimeType, i) => ({ id: String(i), name: "a", mimeType, modifiedTime: "" })));
    expect(entries.map(e => e.kind)).toEqual(["inventory", "image", "video", "shortcut", "other"]);
    expect(entries[0].contentStatus).toBe("inventory_preview_available");
    expect(entries.every(e => e.reviewStatus === "pending" && !e.publicationAllowed)).toBe(true);
    expect(entries.every(e => e.sourceModifiedAt === null)).toBe(true);
  });
});
