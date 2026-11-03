import rawProjects from "@/data/seed/projects.json";
import { countByRec } from "./filters";
import { parseCatalogRows } from "./schema";
import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { showRecLabels, toPublicProject } from "./public-catalog";
import type { CatalogMeta, CatalogProject } from "./types";
import { withTimeout } from "./with-timeout";

const DB_TIMEOUT_MS = 8000;

function parseSeedProjects(): CatalogProject[] {
  return parseCatalogRows(rawProjects as unknown[], (i, e) =>
    console.error("[catalog] invalid seed row", i, e.issues[0]?.message),
  );
}

export async function getProjects(): Promise<CatalogProject[]> {
  const rows = await loadProjects();
  return rows.map((p) => toPublicProject(p));
}

async function loadProjects(): Promise<CatalogProject[]> {
  const fallback = parseSeedProjects();
  if (!hasSupabasePublicConfig()) return fallback;

  return withTimeout(
    (async (): Promise<CatalogProject[]> => {
      try {
        const supabase = createAnonClient();
        const { data, error } = await supabase
          .from("catalog_projects")
          .select("payload")
          .eq("is_published", true)
          .eq("moderation_status", "published")
          .order("legacy_id", { ascending: true });
        if (error) {
          console.error("[catalog] DB read failed, serving seed fallback:", error.message);
          return fallback;
        }
        if (!data?.length) {
          console.error("[catalog] DB returned no published projects, serving seed fallback");
          return fallback;
        }
        return parseCatalogRows(
          data.map((r) => r.payload),
          (i, e) => console.error("[catalog] skipping invalid DB row", i, e.issues[0]?.message),
        );
      } catch (e) {
        console.error("[catalog] DB read threw, serving seed fallback:", e);
        return fallback;
      }
    })(),
    DB_TIMEOUT_MS,
    fallback,
  );
}

export function getCatalogMeta(projects: CatalogProject[]): CatalogMeta {
  const rec = countByRec(projects);
  const yields = projects.map((p) => p.yN).filter((y) => typeof y === "number");
  const avgYield =
    yields.length === 0
      ? 0
      : yields.reduce((a, b) => a + b, 0) / yields.length;

  return {
    quarterLabel: "Q2 2026",
    totalProjects: projects.length,
    /** Market headline — same order of magnitude as legacy catalogue */
    totalValueBnTHB: 71,
    avgYieldPct: Math.round(avgYield * 100) / 100,
    buyCount: showRecLabels() ? rec.BUY : 0,
    watchCount: showRecLabels() ? rec.WATCH : projects.length,
    avoidCount: showRecLabels() ? rec.AVOID : 0,
  };
}

/** Текст методологии из админки (публично на вкладке Analytics). */
export async function getPublicRatingMethodology(): Promise<{
  ru: string;
  en: string;
} | null> {
  if (!hasSupabasePublicConfig()) return null;
  return withTimeout(
    (async (): Promise<{ ru: string; en: string } | null> => {
      try {
        const supabase = createAnonClient();
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "rating_methodology")
          .maybeSingle();
        if (!data?.value || typeof data.value !== "object") return null;
        const v = data.value as { ru?: unknown; en?: unknown };
        const ru = typeof v.ru === "string" ? v.ru.trim() : "";
        const en = typeof v.en === "string" ? v.en.trim() : "";
        if (!ru && !en) return null;
        return { ru, en };
      } catch {
        return null;
      }
    })(),
    DB_TIMEOUT_MS,
    null,
  );
}

export async function getCatalogHeadlineFromDb(): Promise<{
  totalValueBnTHB: number;
  quarterLabel: string;
} | null> {
  if (!hasSupabasePublicConfig()) return null;
  return withTimeout(
    (async (): Promise<{
      totalValueBnTHB: number;
      quarterLabel: string;
    } | null> => {
      try {
        const supabase = createAnonClient();
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "catalog_headline")
          .maybeSingle();
        if (!data?.value || typeof data.value !== "object") return null;
        const v = data.value as {
          totalValueBnTHB?: unknown;
          quarterLabel?: unknown;
        };
        return {
          totalValueBnTHB:
            typeof v.totalValueBnTHB === "number" &&
            Number.isFinite(v.totalValueBnTHB)
              ? v.totalValueBnTHB
              : 71,
          quarterLabel:
            typeof v.quarterLabel === "string" ? v.quarterLabel : "Q2 2026",
        };
      } catch {
        return null;
      }
    })(),
    DB_TIMEOUT_MS,
    null,
  );
}

export async function getProjectByLegacyId(
  legacyId: number,
): Promise<CatalogProject | null> {
  const projects = await getProjects();
  return projects.find((p) => p.id === legacyId) ?? null;
}
