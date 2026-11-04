import { describe, expect, it } from "vitest";
import {
  normalizeSourceUrl,
  sourceFreshness,
  sourceHost,
  sourceInputSchema,
} from "./sources";

const pid = "00000000-0000-4000-8000-000000000001";

describe("normalizeSourceUrl", () => {
  it("accepts https links", () => {
    expect(normalizeSourceUrl(" https://drive.google.com/drive/folders/abc ")).toBe(
      "https://drive.google.com/drive/folders/abc",
    );
  });
  it("rejects other schemes, credentials and junk", () => {
    for (const bad of [
      "http://example.com",
      "javascript:alert(1)",
      "https://user:pw@example.com",
      "https://exa mple.com",
      "ftp://x.y",
      "t.me/chan",
      "",
    ])
      expect(normalizeSourceUrl(bad)).toBeNull();
  });
});

describe("sourceHost", () => {
  it("names common hosting services", () => {
    expect(sourceHost("https://t.me/dev_chan")).toBe("Telegram");
    expect(sourceHost("https://drive.google.com/x")).toBe("Google Drive");
    expect(sourceHost("https://www.dropbox.com/s/1")).toBe("Dropbox");
    expect(sourceHost("https://dev.example.com/a")).toBe("dev.example.com");
  });
});

describe("sourceFreshness", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  it("flags unconfirmed and stale feeds", () => {
    expect(sourceFreshness("weekly", null, now)).toBe("unconfirmed");
    expect(sourceFreshness("weekly", "2026-11-08T00:00:00Z", now)).toBe("fresh");
    expect(sourceFreshness("weekly", "2026-10-20T00:00:00Z", now)).toBe("stale");
    expect(sourceFreshness("none", "2020-01-01T00:00:00Z", now)).toBe("fresh");
  });
});

describe("sourceInputSchema", () => {
  it("applies safe defaults (not public)", () => {
    const r = sourceInputSchema.parse({
      project_id: pid,
      kind: "brochure",
      title: "Брошюра",
      url: "https://example.com/b.pdf",
    });
    expect(r.visibility).toBe("partners");
    expect(r.cadence).toBe("none");
  });
  it("rejects non-https url and unknown kind", () => {
    expect(
      sourceInputSchema.safeParse({ project_id: pid, kind: "brochure", title: "x", url: "http://a.b" }).success,
    ).toBe(false);
    expect(
      sourceInputSchema.safeParse({ project_id: pid, kind: "nope", title: "x", url: "https://a.b" }).success,
    ).toBe(false);
  });
});
