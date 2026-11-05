import { describe, expect, it } from "vitest";
import { comparePriceSnapshots, type PriceSnapshot } from "./compare";

const make = (overrides: Partial<PriceSnapshot["source"]> = {}, units: PriceSnapshot["units"] = []): PriceSnapshot => ({
  source: {
    projectId: "IE-050",
    url: "https://t.me/thetitleheritagebangtao/848",
    publishedAt: "2026-10-25T10:00:00+07:00",
    version: "V4",
    coverage: "full",
    scope: "entire-project",
    ...overrides,
  },
  units,
});
const unit = (status: "available" | "reserved" | "hold" | "sold" | "unknown" = "available") =>
  ({ building: "G", unit: "G409", price: 8500000, currency: "THB", status });

describe("developer price snapshots", () => {
  it("identifies price and status changes without inventing a sale", () => {
    const old = make({ version: "V3" }, [unit()]);
    const updated = make({}, [{ ...unit("reserved"), price: 8750000 }]);
    const { changes } = comparePriceSnapshots(old, updated);
    expect(changes.map((c) => c.kind)).toEqual(["price", "status"]);
    expect(changes[1]).toMatchObject({ previous: "available", next: "reserved" });
  });

  it("does not infer removals from a partial selection", () => {
    const previous = make({}, [unit()]);
    const next = make({ coverage: "partial", publishedAt: "2026-11-01T00:00:00+07:00" }, []);
    expect(comparePriceSnapshots(previous, next)).toMatchObject({ changes: [], absencesCompared: false });
  });

  it("flags absence as unconfirmed, never sold, even with full coverage", () => {
    const result = comparePriceSnapshots(make({}, [unit()]),
      make({ publishedAt: "2026-11-01T00:00:00+07:00" }, []));
    expect(result.changes[0].kind).toBe("absent_unconfirmed");
  });

  it("does not compare absences across different coverage scopes", () => {
    expect(comparePriceSnapshots(make({}, [unit()]),
      make({ scope: "building-H", publishedAt: "2026-11-01T00:00:00+07:00" }, []))
      .absencesCompared).toBe(false);
  });

  it("does not treat an unknown status as a change", () => {
    expect(comparePriceSnapshots(make({}, [unit()]),
      make({}, [unit("unknown")])).changes).toEqual([]);
  });

  it("preserves hold as separate from reserved", () => {
    const changes = comparePriceSnapshots(make({}, [unit("hold")]),
      make({}, [unit("reserved")])).changes;
    expect(changes).toMatchObject([{ kind: "status", previous: "hold", next: "reserved" }]);
  });

  it("rejects duplicate project-building-unit identities", () => {
    expect(() => comparePriceSnapshots(make(), make({}, [unit(), { ...unit(), unit: " g409 " }])))
      .toThrow("Duplicate unit");
  });

  it("rejects mixed projects and backward-dated sources", () => {
    expect(() => comparePriceSnapshots(make(), make({ projectId: "IE-041" })))
      .toThrow("different projects");
    expect(() => comparePriceSnapshots(make(), make({ publishedAt: "2026-10-01" })))
      .toThrow("older source");
  });
});
