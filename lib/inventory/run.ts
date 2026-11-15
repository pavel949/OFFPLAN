import type { SupabaseClient } from "@supabase/supabase-js";
import { activeJurisdiction } from "../jurisdiction";
import {
  applyUnitPlan,
  UnitImportError,
  loadExistingUnits,
  planUnitImport,
  type ImportSource,
} from "./apply";
import { parseInventoryText } from "./parse";

export interface ImportSample {
  kind: "insert" | "update";
  label: string;
  detail: string;
}

export interface ImportState {
  ok: boolean;
  error?: string;
  mode?: "preview" | "apply";
  /** True when the input is clean and can be applied. */
  canApply?: boolean;
  summary?: { inserts: number; updates: number; unchanged: number; untouched: number };
  errors?: { line: number; message: string }[];
  sample?: ImportSample[];
  applied?: { inserted: number; updated: number };
}

const FIELD_RU: Record<string, string> = {
  label: "лот",
  external_key: "ключ",
  bedrooms: "спальни",
  floor: "этаж",
  sqm: "площадь",
  price_thb: "цена",
  currency: "валюта",
  status: "статус",
};

/** Shared by partner (RLS client) and admin/operator (service client) entry points. No auth here. */
export async function runUnitImport(input: {
  db: SupabaseClient;
  projectId: string;
  text: string;
  mode: "preview" | "apply";
  source: ImportSource;
  actorId: string | null;
}): Promise<ImportState> {
  const parsed = parseInventoryText(input.text, activeJurisdiction().currency);
  if (parsed.errors.length) {
    return { ok: false, mode: input.mode, canApply: false, errors: parsed.errors.slice(0, 50), error: `Найдено ошибок: ${parsed.errors.length}. Исправьте и повторите.` };
  }
  try {
    const existing = await loadExistingUnits(input.db, input.projectId);
    const plan = planUnitImport(existing, parsed.rows);
    const summary = {
      inserts: plan.inserts.length,
      updates: plan.updates.length,
      unchanged: plan.unchanged,
      untouched: plan.untouched,
    };
    if (input.mode === "preview") {
      const sample: ImportSample[] = [
        ...plan.inserts.slice(0, 15).map((r) => ({
          kind: "insert" as const,
          label: r.label,
          detail: `${r.price ?? "—"} ${r.currency} · ${r.status}`,
        })),
        ...plan.updates.slice(0, 15).map((u) => ({
          kind: "update" as const,
          label: u.label,
          detail: Object.entries(u.changes)
            .map(([f, [a, b]]) => `${FIELD_RU[f] ?? f}: ${a ?? "—"} → ${b ?? "—"}`)
            .join("; "),
        })),
      ];
      return { ok: true, mode: "preview", canApply: summary.inserts + summary.updates > 0, summary, sample };
    }
    const applied = await applyUnitPlan(input.db, input.projectId, existing, plan, {
      source: input.source,
      actorId: input.actorId,
    });
    return { ok: true, mode: "apply", summary, applied };
  } catch (e) {
    console.error("[inventory] import failed", e);
    return { ok: false, mode: input.mode, canApply: false, ...(e instanceof UnitImportError ? { applied: e.applied } : {}), error: e instanceof Error ? e.message : "Ошибка импорта" };
  }
}
