import rawProjects from "@/data/seed/projects.json";
import { countByRec } from "./filters";
import { parseCatalogRows } from "./schema";
import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import { createServiceRoleClient, hasSupabaseServiceConfig } from "./supabase/service";
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

/** Thrown in production when the database is configured but unreachable and nothing safe can be served. */
export class CatalogUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Catalogue database is unavailable and no last-known-good copy exists");
    this.name = "CatalogUnavailableError";
    this.cause = cause;
  }
}

/** Last successful DB read of this server instance. Safer than seed data: it is real, published, moderated. */
let lastKnownGood: CatalogProject[] | null = null;

export function __resetCatalogCacheForTests() {
  lastKnownGood = null;
}

/**
 * Where rows come from.
 *  - Supabase not configured at all  -> bundled seed (local development / demo).
 *  - DB read OK                      -> DB rows (also remembered as last-known-good).
 *  - DB read failed                  -> last-known-good; else seed in development;
 *                                       in production a hard error (never silently serve seed data:
 *                                       it would resurrect unpublished / rejected projects and stale prices).
 */
async function loadProjects(): Promise<CatalogProject[]> {
  if (!hasSupabasePublicConfig()) return parseSeedProjects();

  const dev = process.env.NODE_ENV !== "production";
  try {
    const rows = await withTimeoutOrThrow(readPublishedFromDb(), DB_TIMEOUT_MS);
    if (rows.length > 0) lastKnownGood = rows;
    else if (dev) {
      console.error("[catalog] DB has no published projects, serving seed (development only)");
      return parseSeedProjects();
    }
    return rows;
  } catch (e) {
    console.error("[catalog] DB read failed:", e instanceof Error ? e.message : e);
    if (lastKnownGood) return lastKnownGood;
    if (dev) return parseSeedProjects();
    throw new CatalogUnavailableError(e);
  }
}

async function readPublishedFromDb(): Promise<CatalogProject[]> {
  // Editorial labels (rec/recText) are only read when publishing them is explicitly enabled,
  // and then only by trusted server code. Everything else goes through the public view,
  // which has them neutralised and never exposes draft_payload.
  let data: { payload: unknown }[] | null;
  let error: { message: string } | null;
  if (showRecLabels() && hasSupabaseServiceConfig()) {
    ({ data, error } = await createServiceRoleClient()
      .from("catalog_projects")
      .select("payload")
      .eq("is_published", true)
      .eq("moderation_status", "published")
      .order("legacy_id", { ascending: true }));
  } else {
    ({ data, error } = await createAnonClient()
      .from("public_catalog_projects")
      .select("payload")
      .order("legacy_id", { ascending: true }));
  }
  if (error) throw new Error(error.message);
  return parseCatalogRows(
    (data ?? []).map((r) => r.payload),
    (i, e) => console.error("[catalog] skipping invalid DB row", i, e.issues[0]?.message),
  );
}

function withTimeoutOrThrow<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
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
