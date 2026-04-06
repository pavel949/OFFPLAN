import rawProjects from "@/data/seed/projects.json";
import { countByRec } from "./filters";
import { catalogProjectsSchema } from "./schema";
import { hasSupabaseServiceConfig, createServiceRoleClient } from "./supabase/service";
import type { CatalogMeta, CatalogProject } from "./types";
import { withTimeout } from "./with-timeout";

const DB_TIMEOUT_MS = 8000;

function parseSeedProjects(): CatalogProject[] {
  try {
    return catalogProjectsSchema.parse(rawProjects);
  } catch {
    return [];
  }
}

export async function getProjects(): Promise<CatalogProject[]> {
  const fallback = parseSeedProjects();
  if (!hasSupabaseServiceConfig()) return fallback;

  return withTimeout(
    (async (): Promise<CatalogProject[]> => {
      try {
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
          .from("catalog_projects")
          .select("payload")
          .eq("is_published", true)
          .eq("moderation_status", "published")
          .order("legacy_id", { ascending: true });
        if (!error && data?.length) {
          const rows = data.map((r) => r.payload);
          return catalogProjectsSchema.parse(rows);
        }
      } catch {
        /* fallback below */
      }
      return fallback;
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
    buyCount: rec.BUY,
    watchCount: rec.WATCH,
    avoidCount: rec.AVOID,
  };
}

/** Optional headline from `platform_settings.catalog_headline` (admin). */
/** Текст методологии из админки (публично на вкладке Analytics). */
export async function getPublicRatingMethodology(): Promise<{
  ru: string;
  en: string;
} | null> {
  if (!hasSupabaseServiceConfig()) return null;
  return withTimeout(
    (async (): Promise<{ ru: string; en: string } | null> => {
      try {
        const supabase = createServiceRoleClient();
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
  if (!hasSupabaseServiceConfig()) return null;
  return withTimeout(
    (async (): Promise<{
      totalValueBnTHB: number;
      quarterLabel: string;
    } | null> => {
      try {
        const supabase = createServiceRoleClient();
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
