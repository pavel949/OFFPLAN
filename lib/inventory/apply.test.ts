import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyUnitPlan, loadExistingUnits, planUnitImport, UnitImportError, type ExistingUnit } from "./apply";
import { parseInventoryText } from "./parse";
import type { ParsedUnit } from "./parse";

const row = (label: string): ParsedUnit => ({ line: 2, label, externalKey: null, bedrooms: null, floor: null, sqm: null, price: 100, currency: "THB", status: "available" });
const unit = (r: ParsedUnit): ExistingUnit => ({ id: r.label, label: r.label, external_key: null, bedrooms: null, floor: null, sqm: null, price_thb: r.price, currency: r.currency, status: r.status, sort_order: 0 });
const opts = { source: "import" as const, actorId: null };

describe("inventory partial writes", () => {
  it("loads beyond the API row limit before planning a retry", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => unit(row(`U${i}`)));
    const ranges: number[] = [];
    const chain = { select: () => chain, eq: () => chain, order: () => chain,
      range: async (from: number, to: number) => { ranges.push(from); return { data: rows.slice(from, to + 1), error: null }; } };
    const db = { from: () => chain } as unknown as SupabaseClient;
    const loaded = await loadExistingUnits(db, "project");
    expect(ranges).toEqual([0, 1000]);
    expect(loaded).toHaveLength(1001);
    expect(planUnitImport(loaded, [row("U1000")]).inserts).toHaveLength(0);
  });

  it("does not erase omitted fields when a price-only file updates an existing unit", () => {
    const existing = [{ ...unit(row("A")), bedrooms: 2, floor: 3, sqm: 70, currency: "USD", status: "sold" }];
    const parsed = parseInventoryText("label,price\nA,200");
    expect(parsed.errors).toEqual([]);
    const plan = planUnitImport(existing, parsed.rows);
    expect(plan.updates[0].changes).toEqual({ price_thb: [100, 200] });
    const fresh = planUnitImport([], parsed.rows);
    expect(fresh.inserts[0].status).toBe("unknown");
  });

  it("counts committed insert batches and replans a retry without inserting them again", async () => {
    const rows = Array.from({ length: 201 }, (_, i) => row(`U${i}`));
    let calls = 0;
    const db = { from: () => ({ insert: async () => ({ error: ++calls === 2 ? { message: "timeout" } : null }) }) } as unknown as SupabaseClient;
    const error = await applyUnitPlan(db, "project", [], planUnitImport([], rows), opts).catch(e => e);
    expect(error).toBeInstanceOf(UnitImportError);
    expect(error.applied).toEqual({ inserted: 200, updated: 0 });
    const retry = planUnitImport(rows.slice(0, 200).map(unit), rows);
    expect(retry.inserts.map(r => r.label)).toEqual(["U200"]);
    expect(retry.unchanged).toBe(200);
  });

  it("counts successful updates in a batch even when another update affects no visible row", async () => {
    const rows = [row("A"), row("B")];
    const existing = rows.map(r => ({ ...unit(r), price_thb: 50 }));
    let calls = 0;
    const chain = { eq: () => chain, select: async () => ({ error: null, data: ++calls === 1 ? [{ id: "A" }] : [] }) };
    const db = { from: () => ({ update: () => chain }) } as unknown as SupabaseClient;
    const error = await applyUnitPlan(db, "project", existing, planUnitImport(existing, rows), opts).catch(e => e);
    expect(error).toBeInstanceOf(UnitImportError);
    expect(error.applied).toEqual({ inserted: 0, updated: 1 });
    expect(error.message).toContain("Проверить");
  });

  it("reports acknowledged progress on a thrown network failure without claiming rollback", async () => {
    const db = { from: () => ({ insert: async () => { throw new Error("network"); } }) } as unknown as SupabaseClient;
    await expect(applyUnitPlan(db, "project", [], planUnitImport([], [row("A")]), opts)).rejects.toMatchObject({ applied: { inserted: 0, updated: 0 }, message: expect.stringContaining("частично") });
  });
});
