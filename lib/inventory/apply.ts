import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeKey, type ParsedUnit } from "./parse";

export interface ExistingUnit {
  id: string;
  label: string;
  external_key: string | null;
  bedrooms: number | null;
  floor: number | null;
  sqm: number | null;
  price_thb: number | null;
  currency: string;
  status: string;
  sort_order: number;
}

export interface UnitUpdate {
  id: string;
  label: string;
  row: ParsedUnit;
  /** field → [old, new] */
  changes: Record<string, [unknown, unknown]>;
}

export interface UnitPlan {
  inserts: ParsedUnit[];
  updates: UnitUpdate[];
  unchanged: number;
  /** existing units that are not in the file (left untouched, never deleted) */
  untouched: number;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

/** Pure: decide which rows are inserted / updated / unchanged. Matching: external key, else label. */
export function planUnitImport(existing: ExistingUnit[], rows: ParsedUnit[]): UnitPlan {
  const byKey = new Map<string, ExistingUnit>();
  const byLabel = new Map<string, ExistingUnit>();
  for (const u of existing) {
    if (u.external_key) byKey.set(normalizeKey(u.external_key), u);
    byLabel.set(normalizeKey(u.label), u);
  }
  const plan: UnitPlan = { inserts: [], updates: [], unchanged: 0, untouched: 0 };
  const matched = new Set<string>();

  for (const r of rows) {
    const hit =
      (r.externalKey ? byKey.get(normalizeKey(r.externalKey)) : undefined) ??
      byLabel.get(normalizeKey(r.label));
    if (!hit) {
      plan.inserts.push(r);
      continue;
    }
    matched.add(hit.id);
    const changes: Record<string, [unknown, unknown]> = {};
    const cmp = (field: string, a: unknown, b: unknown) => {
      if (a !== b) changes[field] = [a, b];
    };
    if (normalizeKey(hit.label) !== normalizeKey(r.label)) changes.label = [hit.label, r.label];
    if (r.externalKey) cmp("external_key", hit.external_key, r.externalKey);
    cmp("bedrooms", num(hit.bedrooms), r.bedrooms);
    cmp("floor", num(hit.floor), r.floor);
    cmp("sqm", num(hit.sqm), r.sqm);
    cmp("price_thb", num(hit.price_thb), r.price);
    cmp("currency", hit.currency, r.currency);
    cmp("status", hit.status, r.status);
    if (Object.keys(changes).length) plan.updates.push({ id: hit.id, label: r.label, row: r, changes });
    else plan.unchanged += 1;
  }
  plan.untouched = existing.filter((u) => !matched.has(u.id)).length;
  return plan;
}

export async function loadExistingUnits(db: SupabaseClient, projectId: string): Promise<ExistingUnit[]> {
  const { data, error } = await db
    .from("project_units")
    .select("id, label, external_key, bedrooms, floor, sqm, price_thb, currency, status, sort_order")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExistingUnit[];
}

export type ImportSource = "import" | "operator";

export async function applyUnitPlan(
  db: SupabaseClient,
  projectId: string,
  existing: ExistingUnit[],
  plan: UnitPlan,
  opts: { source: ImportSource; actorId: string | null },
): Promise<{ inserted: number; updated: number }> {
  const now = new Date().toISOString();
  const base = existing.reduce((m, u) => Math.max(m, u.sort_order ?? 0), 0) + 1;

  const insertRows = plan.inserts.map((r, i) => ({
    project_id: projectId,
    label: r.label,
    external_key: r.externalKey,
    bedrooms: r.bedrooms,
    floor: r.floor,
    sqm: r.sqm,
    price_thb: r.price,
    currency: r.currency,
    status: r.status,
    source: opts.source,
    entered_by: opts.actorId,
    sort_order: base + i,
    updated_at: now,
  }));
  for (let i = 0; i < insertRows.length; i += 200) {
    const { error } = await db.from("project_units").insert(insertRows.slice(i, i + 200));
    if (error) throw new Error(`Вставка: ${error.message}`);
  }

  for (let i = 0; i < plan.updates.length; i += 20) {
    const chunk = plan.updates.slice(i, i + 20);
    const results = await Promise.all(
      chunk.map((u) =>
        db
          .from("project_units")
          .update({
            label: u.row.label,
            ...(u.row.externalKey ? { external_key: u.row.externalKey } : {}),
            bedrooms: u.row.bedrooms,
            floor: u.row.floor,
            sqm: u.row.sqm,
            price_thb: u.row.price,
            currency: u.row.currency,
            status: u.row.status,
            source: opts.source,
            entered_by: opts.actorId,
            updated_at: now,
          })
          .eq("id", u.id)
          .eq("project_id", projectId),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(`Обновление: ${failed.error.message}`);
  }
  return { inserted: insertRows.length, updated: plan.updates.length };
}
