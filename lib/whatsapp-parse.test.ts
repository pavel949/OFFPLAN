import { describe, expect, it } from "vitest";
import { parseWhatsAppText } from "./whatsapp-parse";

describe("parseWhatsAppText", () => {
  it("parses bracket format", () => {
    const r = parseWhatsAppText(
      "[01/04/2026, 14:30:01] John: Check https://example.com/page\n",
    );
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.urls.some((u) => u.includes("example.com"))).toBe(true);
  });
});
