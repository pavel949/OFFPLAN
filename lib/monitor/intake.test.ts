import { describe, expect, it } from "vitest";
import { parseInventoryText } from "../inventory/parse";
import { comparePriceSnapshots } from "./compare";
import { preparePriceList } from "./intake";

import { priceFile, projectId } from "./fixture";

describe("price-list intake", () => {
  it("normalizes the source and uses the same archive key on a retry", () => {
    const first = preparePriceList(priceFile());
    const retry = preparePriceList(priceFile(undefined, { scope: " корпус  g " }));
    expect(retry.id).toBe(first.id);
    expect(retry.storagePath).toBe(first.storagePath);
    expect(first.archive.sha256).toMatch(/^[a-f\d]{64}$/);
    expect(first.archive.snapshot.source).toMatchObject({
      projectId, publishedAt: "2025-10-25T03:00:00.000Z", version: "V4",
    });
    expect(first.archive.snapshot.units[0]).toMatchObject({ building: "G", unit: "G409", status: "hold" });
  });

  it("handles a partial update and keeps Hold separate from Reserved", () => {
    const previous = preparePriceList(priceFile("G,G409,8500000,Hold,THB\nG,G410,9500000,available,THB")).archive.snapshot;
    const current = preparePriceList(priceFile("G,G409,8750000,Reserved,THB", {
      publishedAt: "2025-10-26T10:00:00+07:00", version: "V5", coverage: "partial",
    })).archive.snapshot;
    expect(comparePriceSnapshots(previous, current)).toMatchObject({
      absencesCompared: false,
      changes: [
        { kind: "price", previous: 8500000, next: 8750000 },
        { kind: "status", previous: "hold", next: "reserved" },
      ],
    });
    expect(parseInventoryText("unit,price,status\nG409,8500000,Hold").errors).toHaveLength(1);
  });

  it("permits the same unit number in distinct buildings but rejects an ambiguous physical unit", () => {
    expect(preparePriceList(priceFile("G,409,8500000,hold,THB\nH,409,9000000,available,THB")).archive.snapshot.units).toHaveLength(2);
    expect(() => preparePriceList(priceFile("G,409,8500000,hold,THB\ng,409,9000000,available,THB"))).toThrow("Duplicate unit");
  });

  it("rejects malformed or ambiguous CSV and unsupported attachments", () => {
    expect(() => preparePriceList(priceFile('G,G409,"8500000,Hold,THB'))).toThrow("кавычка");
    expect(() => preparePriceList(priceFile("G,G409,USD 8500000,Hold,THB"))).toThrow("валюты");
    expect(() => preparePriceList({ ...priceFile(), filename: "price.xlsx" })).toThrow("CSV или TSV");
    expect(() => preparePriceList(priceFile(undefined, { url: "javascript:alert(1)" }))).toThrow("HTTPS");
  });
});
