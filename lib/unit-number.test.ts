import { describe, expect, it } from "vitest";
import { parseUnitNumber } from "./unit-number";

describe("operator unit numbers", () => {
  it("preserves Russian decimals instead of multiplying values", () => {
    expect(parseUnitNumber("35,5")).toBe(35.5);
    expect(parseUnitNumber("35,50")).toBe(35.5);
    expect(parseUnitNumber("35.125")).toBe(35.125);
    expect(parseUnitNumber("1 234,50")).toBe(1234.5);
  });
  it("accepts explicit space-grouped prices including nonbreaking spaces", () => {
    expect(parseUnitNumber("1 000 000")).toBe(1_000_000);
    expect(parseUnitNumber("1\u00a0000\u202f000.25")).toBe(1_000_000.25);
    expect(parseUnitNumber("0")).toBe(0);
    expect(parseUnitNumber("  ")).toBeNull();
  });
  it("rejects ambiguous or malformed formats rather than silently changing them", () => {
    for (const value of ["1,234", "35,500", "1,234,567", "35 5", "1 00", "1.234,56", "1,234.56", "0x10", "1e6", "Infinity", "NaN"]) {
      expect(parseUnitNumber(value)).toBeNaN();
    }
  });
});
