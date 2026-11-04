import rawProjects from "@/data/seed/projects.json";
import ruSeedTexts from "@/data/i18n/projects.ru.json";
import { countByRec } from "./filters";
import { parseCatalogRows } from "./schema";
import { createAnonClient, hasSupabasePublicConfig } from "./supabase/anon";
import {
  createServiceRoleClient,
  hasSupabaseServiceConfig,
} from "./supabase/service";
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
    const ru =
      db?.get(p.id) ??
      (process.env.NODE_ENV !== "production"
        ? RU_SEED[String(p.id)]
        : undefined);
    return ru ? { ...p, i18n: { ru } } : p;
  });
}

/** Best-effort: registry verification per project. Never blocks the catalogue. */
async function loadVerification(
  supabase: ReturnType<typeof createAnonClient>,
): Promise<Map<number, NonNullable<CatalogProject["ver"]>> | undefined> {
  try {
    const { data, error } = await supabase
      .from("public_catalog_projects")
      .select(
        "legacy_id, verification_level, verified_at, verification_expires_at",
      )
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
      .select(
        "project_id, description, status_text, completion_text, tags, review_status",
      )
      .eq("locale", "ru")
      .eq("review_status", "reviewed");
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

async function loadSales(
  client: ReturnType<typeof createAnonClient>,
  idMap: Map<string, number>,
) {
  const out = new Map<number, NonNullable<CatalogProject["sales"]>>();
  try {
    const [inventory, facts] = await Promise.all([
      client
        .from("public_project_inventory")
        .select("project_id,recorded,available"),
      client
        .from("project_evidence")
        .select("project_id,details")
        .eq("kind", "sales")
        .eq("status", "published"),
    ]);
    for (const row of inventory.data ?? []) {
      const id = idMap.get(row.project_id);
      if (id != null)
        out.set(id, { available: row.available, recorded: row.recorded });
    }
    for (const row of facts.data ?? []) {
      const id = idMap.get(row.project_id);
      if (id != null)
        out.set(id, { ...out.get(id), stage: row.details?.stage });
    }
  } catch {
    /* Missing facts remain unknown; never substitute seed inventory. */
  }
  return out;
}

export async function getProjects(): Promise<CatalogProject[]> {
  const rows = await loadProjects();
  return rows.map((p) => toPublicProject(p));
}

/** Thrown in production when the database is unavailable; cached rows may have been unpublished. */
export class CatalogUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      "Catalogue database is unavailable",
    );
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
 *  - DB read OK                      -> current published DB rows.
 *  - DB read failed                  -> last-known-good/seed in development only;
 *                                       in production a hard error (never silently serve seed or cached data:
 *                                       it would resurrect unpublished / rejected projects and stale prices).
 */
async function loadProjects(): Promise<CatalogProject[]> {
  if (!hasSupabasePublicConfig()) {
    if (process.env.NODE_ENV === "production")
      throw new CatalogUnavailableError(
        new Error("Supabase is not configured"),
      );
    return parseSeedProjects();
  }

  const dev = process.env.NODE_ENV !== "production";
  try {
    const rows = await withTimeoutOrThrow(readPublishedFromDb(), DB_TIMEOUT_MS);
    lastKnownGood = rows;
    if (rows.length === 0 && dev) {
      console.error(
        "[catalog] DB has no published projects, serving seed (development only)",
      );
      return parseSeedProjects();
    }
    return rows;
  } catch (e) {
    console.error(
      "[catalog] DB read failed:",
      e instanceof Error ? e.message : e,
    );
    // A cached row may have been unpublished since the last successful read.
    if (dev && lastKnownGood) return lastKnownGood;
    if (dev) return parseSeedProjects();
    throw new CatalogUnavailableError(e);
  }
}

async function readPublishedFromDb(): Promise<CatalogProject[]> {
  // Editorial labels (rec/recText) are only read when publishing them is explicitly enabled,
  // and then only by trusted server code. Everything else goes through the public view,
  // which has them neutralised and never exposes draft_payload.
  let data: { id?: string; legacy_id?: number; data_confirmed_at?: string | null; payload: unknown }[] | null;
  let error: { message: string } | null;
  if (showRecLabels() && hasSupabaseServiceConfig()) {
    ({ data, error } = await createServiceRoleClient()
      .from("catalog_projects")
      .select("id, legacy_id, payload, data_confirmed_at")
      .eq("is_published", true)
      .eq("moderation_status", "published")
      .order("legacy_id", { ascending: true }));
  } else {
    ({ data, error } = await createAnonClient()
      .from("public_catalog_projects")
      .select("id, legacy_id, payload, data_confirmed_at")
      .order("legacy_id", { ascending: true }));
  }
  if (error) throw new Error(error.message);
  const rows = parseCatalogRows(
    (data ?? []).map((r) => r.payload),
    (i, e) =>
      console.error(
        "[catalog] skipping invalid DB row",
        i,
        e.issues[0]?.message,
      ),
  );
  const client = createAnonClient();
  const idMap = new Map(
    (data ?? [])
      .filter((r) => r.id && r.legacy_id != null)
      .map((r) => [r.id!, r.legacy_id!]),
  );
  const [texts, ver, sales] = await Promise.all([
    loadDbRuTexts(client, idMap),
    loadVerification(client),
    loadSales(client, idMap),
  ]);
  const confirmed = new Map((data ?? []).map((r) => [r.legacy_id, r.data_confirmed_at ?? null]));
  return attachRu(rows, texts).map((p) => ({
    ...p,
    dataConfirmedAt: confirmed.get(p.id) ?? null,
    ...(ver?.has(p.id) ? { ver: ver.get(p.id) } : {}),
    ...(sales.has(p.id) ? { sales: sales.get(p.id) } : {}),
  }));
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
    yields.length === 0 ? 0 : yields.reduce((a, b) => a + b, 0) / yields.length;

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
