import { describe, expect, it } from "vitest";
import { isSafeWebhookUrl, signWebhook } from "./webhooks";

describe("webhooks", () => {
  it("signs deterministically and depends on timestamp, body and secret", () => {
    const a = signWebhook("s", "1", "{}");
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signWebhook("s", "1", "{}")).toBe(a);
    expect(signWebhook("s", "2", "{}")).not.toBe(a);
    expect(signWebhook("s", "1", "{ }")).not.toBe(a);
    expect(signWebhook("t", "1", "{}")).not.toBe(a);
  });

  it("allows only public https endpoints", () => {
    expect(isSafeWebhookUrl("https://crm.example.com/hook")).toBe(true);
    for (const u of [
      "http://crm.example.com",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.0.0.5/x",
      "https://192.168.1.2/x",
      "https://169.254.169.254/latest",
      "https://172.20.0.1/x",
      "https://svc.internal/x",
      "not a url",
    ]) {
      expect(isSafeWebhookUrl(u)).toBe(false);
    }
  });
});
