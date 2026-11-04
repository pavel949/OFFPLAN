import { describe, expect, it } from "vitest";
import { freshnessOf, formatPrice, summarizeFreshness } from "./freshness";
import { MAX_IMPORT_ROWS, parseInventoryText, parseNumber } from "./parse";

describe("parseNumber", () => {
  it("handles separators, suffixes and symbols", () => {
    expect(parseNumber("9 500 000")).toBe(9_500_000);
    expect(parseNumber("9,500,000")).toBe(9_500_000);
    expect(parseNumber("9.500.000,50")).toBe(9_500_000.5);
    expect(parseNumber("฿9.5M")).toBe(9_500_000);
    expect(parseNumber("9,5 млн")).toBe(9_500_000);
    expect(parseNumber("850 тыс")).toBe(850_000);
    expect(parseNumber("45,5")).toBe(45.5);
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("parseInventoryText", () => {
  it("parses Excel TSV with Russian headers and statuses", () => {
    const t = "Лот\tСпальни\tЭтаж\tПлощадь\tЦена\tСтатус\nA-101\t1\t3\t45,5\t9 500 000\tсвободен\nA-102\t2\t4\t70\t15 200 000\tбронь\nA-103\t2\t5\t72\t\tпродан";
    const r = parseInventoryText(t);
    expect(r.errors).toEqual([]);
    expect(r.delimiter).toBe("\t");
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ label: "A-101", bedrooms: 1, floor: 3, sqm: 45.5, price: 9_500_000, status: "available", currency: "THB" });
    expect(r.rows[1].status).toBe("reserved");
    expect(r.rows[2]).toMatchObject({ status: "sold", price: null });
  });

  it("parses semicolon CSV with quotes and currency symbols", () => {
    const t = 'unit;price;status\n"B 7";฿12.4M;available\nB8;$250K;free';
    const r = parseInventoryText(t);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ label: "B 7", price: 12_400_000, currency: "THB" });
    expect(r.rows[1]).toMatchObject({ price: 250_000, currency: "USD" });
  });

  it("reports row-level errors with line numbers", () => {
    const t = "label,price,status\nA1,9000000,available\nA2,,available\nA3,abc,available\nA4,100,weird\nA1,1,available\n,5,available";
    const r = parseInventoryText(t);
    const msgs = r.errors.map((e) => `${e.line}:${e.message}`).join("\n");
    expect(r.rows.map((x) => x.label)).toEqual(["A1"]);
    expect(msgs).toContain("3:A2: для свободного лота укажите цену");
    expect(msgs).toContain("4:A3: не удалось разобрать цену");
    expect(msgs).toContain("5:A4: неизвестный статус");
    expect(msgs).toContain("6:A1: дубликат");
    expect(msgs).toContain("7:Пустой номер лота");
  });

  it("requires label and price columns and bounds the row count", () => {
    expect(parseInventoryText("foo,bar\n1,2").errors[0].message).toContain("«Лот»");
    expect(parseInventoryText("label,foo\n1,2").errors[0].message).toContain("«Цена»");
    const big = "label,price\n" + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `U${i},1000`).join("\n");
    expect(parseInventoryText(big).errors[0].message).toContain("Слишком много");
    expect(parseInventoryText("").errors).toHaveLength(1);
  });
  it("does not invent availability when an imported status is absent",()=>{
    const r=parseInventoryText("label,price,status\nA101,1000000,\nA102,,уточняется");
    expect(r.errors).toEqual([]);expect(r.rows.map(r=>r.status)).toEqual(["unknown","unknown"]);
  });
});

describe("freshness", () => {
  const now = Date.parse("2026-11-30T00:00:00Z");
  const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
  it("classifies by age", () => {
    expect(freshnessOf(ago(3), now)).toBe("fresh");
    expect(freshnessOf(ago(14), now)).toBe("fresh");
    expect(freshnessOf(ago(20), now)).toBe("stale");
    expect(freshnessOf(ago(31), now)).toBe("expired");
    expect(freshnessOf(null, now)).toBe("expired");
  });
  it("summarises active units and ignores sold", () => {
    const s = summarizeFreshness(
      [
        { price_updated_at: ago(1), status: "available" },
        { price_updated_at: ago(20), status: "reserved" },
        { price_updated_at: ago(99), status: "available" },
        { price_updated_at: ago(99), status: "sold" },
      ],
      now,
    );
    expect(s).toEqual({ fresh: 1, stale: 1, expired: 1, active: 3 });
  });
  it("formats prices per language", () => {
    expect(formatPrice(9_500_000, "THB", "en")).toBe("฿ 9,500,000");
    expect(formatPrice(null, "THB", "ru")).toBe("—");
  });
});

import { planUnitImport, type ExistingUnit } from "./apply";
import type { ParsedUnit } from "./parse";

describe("planUnitImport", () => {
  const ex = (o: Partial<ExistingUnit>): ExistingUnit => ({
    id: "id", label: "A-1", external_key: null, bedrooms: 1, floor: 2, sqm: 40, price_thb: 5_000_000,
    currency: "THB", status: "available", sort_order: 1, ...o,
  });
  const row = (o: Partial<ParsedUnit>): ParsedUnit => ({
    line: 2, label: "A-1", externalKey: null, bedrooms: 1, floor: 2, sqm: 40, price: 5_000_000,
    currency: "THB", status: "available", ...o,
  });

  it("classifies insert / update / unchanged / untouched", () => {
    const existing = [ex({ id: "1", label: "A-1" }), ex({ id: "2", label: "A-2" }), ex({ id: "3", label: "A-3" })];
    const rows = [
      row({ label: "a-1" }), // unchanged (case-insensitive label match)
      row({ label: "A-2", price: 6_000_000, status: "reserved" }), // update
      row({ label: "B-9" }), // insert
    ];
    const p = planUnitImport(existing, rows);
    expect(p.unchanged).toBe(1);
    expect(p.inserts.map((r) => r.label)).toEqual(["B-9"]);
    expect(p.updates).toHaveLength(1);
    expect(p.updates[0].changes).toMatchObject({ price_thb: [5_000_000, 6_000_000], status: ["available", "reserved"] });
    expect(p.untouched).toBe(1); // A-3 not in file, never deleted
  });

  it("matches by external key first and lets the label change", () => {
    const p = planUnitImport([ex({ id: "9", label: "Old", external_key: "K-1" })], [row({ label: "New", externalKey: "k-1" })]);
    expect(p.inserts).toHaveLength(0);
    expect(p.updates[0].changes.label).toEqual(["Old", "New"]);
  });

  it("treats numeric strings from the DB as numbers", () => {
    const p = planUnitImport([ex({ price_thb: "5000000" as unknown as number })], [row({})]);
    expect(p.unchanged).toBe(1);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyUnitPlan } from "./apply";

describe("applyUnitPlan", () => {
  function fakeDb() {
    const calls = { inserts: [] as Record<string, unknown>[][], updates: [] as { patch: Record<string, unknown>; id?: unknown }[] };
    const db = {
      from: () => ({
        insert: async (rows: Record<string, unknown>[]) => {
          calls.inserts.push(rows);
          return { error: null };
        },
        update: (patch: Record<string, unknown>) => {
          const rec: { patch: Record<string, unknown>; id?: unknown } = { patch };
          calls.updates.push(rec);
          const chain = {
            select: async () => ({ error: null, data: [{ id: rec.id }] }),
            eq: (col: string, v: unknown) => {
              if (col === "id") rec.id = v;
              return chain;
            },
          };
          return chain;
        },
      }),
    } as unknown as SupabaseClient;
    return { db, calls };
  }

  it("tags rows with the source, continues sort order and batches inserts", async () => {
    const existing: ExistingUnit[] = [
      { id: "u1", label: "A-1", external_key: null, bedrooms: 1, floor: 1, sqm: 40, price_thb: 1, currency: "THB", status: "available", sort_order: 7 },
    ];
    const rows: ParsedUnit[] = Array.from({ length: 450 }, (_, i) => ({
      line: i + 2, label: `N-${i}`, externalKey: null, bedrooms: null, floor: null, sqm: null, price: 100, currency: "THB", status: "available" as const,
    }));
    rows.push({ line: 999, label: "A-1", externalKey: null, bedrooms: 1, floor: 1, sqm: 40, price: 2, currency: "THB", status: "available" });
    const plan = planUnitImport(existing, rows);
    const { db, calls } = fakeDb();
    const res = await applyUnitPlan(db, "p1", existing, plan, { source: "operator", actorId: null });
    expect(res).toEqual({ inserted: 450, updated: 1 });
    expect(calls.inserts.map((b) => b.length)).toEqual([200, 200, 50]);
    expect(calls.inserts[0][0]).toMatchObject({ project_id: "p1", source: "operator", sort_order: 8, entered_by: null });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].patch).toMatchObject({ price_thb: 2, source: "operator" });
    expect(calls.updates[0].id).toBe("u1");
  });
});
