import type { PriceListFile } from "./intake";

export const projectId = "1a6ae53b-dafd-46d2-b623-16877f16b1ab";
const header = "building,unit,price,status,currency\n";
export function priceFile(rows = "G,G409,8500000,Hold,THB", overrides: Partial<PriceListFile["metadata"]> = {}): PriceListFile {
  return {
    filename: "price.csv",
    bytes: new TextEncoder().encode(header + rows),
    metadata: {
      projectId,
      url: "https://t.me/developer/123",
      publishedAt: "2025-10-25T10:00:00+07:00",
      version: "V4",
      coverage: "full",
      scope: "Корпус G",
      origin: { kind: "manual" },
      ...overrides,
    },
  };
}
