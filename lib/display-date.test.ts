import { describe, expect, it } from "vitest";
import { displayDate } from "./display-date";

describe("evidence calendar dates", () => {
  it.each(["UTC", "America/Los_Angeles", "Asia/Bangkok", "Pacific/Kiritimati"])("keeps the same date in %s", (zone) => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = zone;
      expect(displayDate("2026-11-04", true)).toBe("4 ноября 2026 г.");
      expect(displayDate("2026-11-04", false)).toBe("4 November 2026");
      expect(displayDate("2026-01-01", false)).toBe("1 January 2026");
      expect(displayDate("2024-02-29", false)).toBe("29 February 2024");
      expect(displayDate("2026-11-04T00:00:00Z", false)).toBe("4 November 2026");
      expect(displayDate("2026-11-03T23:59:59Z", false)).toBe("3 November 2026");
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
  it("handles missing or invalid values", () => {
    expect(displayDate(null, true)).toBe("—");
    expect(displayDate("invalid", true)).toBe("—");
  });
});
