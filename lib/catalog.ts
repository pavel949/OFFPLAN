import rawProjects from "@/data/seed/projects.json";
import ruSeedTexts from "@/data/i18n/projects.ru.json";
import { countByRec } from "./filters";
import { parseCatalogRows } from "./schema";
import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { showRecLabels, toPublicProject } from "./public-catalog";
import type { CatalogMeta, CatalogProject, ProjectTexts } from "./types";
import { withTimeout } from "./with-timeout";

const DB_TIMEOUT_MS = 8000;

function parseSeedProjects(): CatalogProject[] {
  return attachRu(
    parseCatalogRows(rawProjects as unknown[], (i, e) =>
      console.error("[catalog] invalid seed row", i, e.issues[0]?.message),
    ),
  );
}

/** Russian texts shipped with the repo (machine drafts, reviewed by editors in the DB). */
const RU_SEED = ruSeedTexts as unknown as Record<string, ProjectTexts>;

function attachRu(
  projects: CatalogProject[],
  db?: Map<number, ProjectTexts>,
): CatalogProject[] {
  return projects.map((p) => {
    const ru = db?.get(p.id) ?? RU_SEED[String(p.id)];
    return ru ? { ...p, i18n: { ru } } : p;
  });
}

/** Best-effort: registry verification per project. Never blocks the catalogue. */
async function loadVerification(
  supabase: ReturnType<typeof createAnonClient>,
): Promise<Map<number, NonNullable<CatalogProject["ver"]>> | undefined> {
  try {
    const { data, error } = await supabase
      .from("catalog_projects")
      .select("legacy_id, verification_level, verified_at, verification_expires_at")
      .eq("is_published", true)
      .eq("moderation_status", "published")
      .gt("verification_level", 0);
    if (error || !data) return undefined;
    const out = new Map<number, NonNullable<CatalogProject["ver"]>>();
    for (const r of data) {
      if (r.legacy_id == null) continue;
      out.set(r.legacy_id as number, {
        level: r.verification_level as 0 | 1 | 2,
        verifiedAt: (r.verified_at as string) ?? null,
        expiresAt: (r.verification_expires_at as string) ?? null,
      });
    }
    return out;
  } catch {
    return undefined;
  }
}

/** Best-effort: translations edited in the DB override the seed. Never blocks the catalogue. */
async function loadDbRuTexts(
  supabase: ReturnType<typeof createAnonClient>,
  idMap: Map<string, number>,
): Promise<Map<number, ProjectTexts> | undefined> {
  try {
    const { data, error } = await supabase
      .from("catalog_project_translations")
      .select("project_id, description, status_text, completion_text, tags, review_status")
      .eq("locale", "ru");
    if (error || !data?.length) return undefined;
    const out = new Map<number, ProjectTexts>();
    for (const r of data) {
      const legacy = idMap.get(r.project_id as string);
      if (legacy == null) continue;
      out.set(legacy, {
        desc: (r.description as string) ?? "",
        stT: (r.status_text as string) ?? "",
        compQ: (r.completion_text as string) ?? "",
        tags: (r.tags as string[]) ?? [],
        reviewStatus: r.review_status as ProjectTexts["reviewStatus"],
      });
    }
    return out;
  } catch {
    return undefined;
  }
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
          .select("id, legacy_id, payload")
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
        const idMap = new Map<string, number>();
        for (const r of data) {
          if (r.legacy_id != null) idMap.set(r.id as string, r.legacy_id as number);
        }
        const rows = parseCatalogRows(
          data.map((r) => r.payload),
          (i, e) => console.error("[catalog] skipping invalid DB row", i, e.issues[0]?.message),
        );
        const ver = await loadVerification(supabase);
        return attachRu(rows, await loadDbRuTexts(supabase, idMap)).map((p) =>
          ver?.has(p.id) ? { ...p, ver: ver.get(p.id) } : p,
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
