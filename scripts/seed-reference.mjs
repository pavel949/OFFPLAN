/**
 * Seed reference data and Russian translations (idempotent).
 *   node --experimental-strip-types scripts/seed-reference.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Run after migrations
 * and after `npm run seed:catalog`.
 *
 * - taxonomy_terms, regions: from lib/taxonomy.ts (single source of truth)
 * - developers: derived from the catalogue (`dt` code)
 * - catalog_projects.region_id / developer_id / jurisdiction_code: linked by legacy id
 * - catalog_project_translations (ru): machine drafts; rows already marked `reviewed` are never overwritten
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeveloperRows,
  buildRegionRows,
  buildTaxonomyRows,
  zoneSlug,
} from "../lib/reference-data.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const projects = read("data/seed/projects.json");
const ru = read("data/i18n/projects.ru.json");

function must(label, { error }) {
  if (error) {
    console.error(`${label}:`, error.message);
    process.exit(1);
  }
}

// 1. taxonomy (global terms)
{
  const rows = buildTaxonomyRows().map((r) => ({ ...r, jurisdiction_code: null }));
  // The unique index uses coalesce(jurisdiction_code,'*'), so upsert manually.
  const { data: existing, error } = await db
    .from("taxonomy_terms")
    .select("id, kind, key")
    .is("jurisdiction_code", null);
  must("taxonomy read", { error });
  const have = new Map((existing ?? []).map((r) => [`${r.kind}:${r.key}`, r.id]));
  for (const r of rows) {
    const id = have.get(`${r.kind}:${r.key}`);
    const res = id
      ? await db.from("taxonomy_terms").update({ label: r.label, sort_order: r.sort_order }).eq("id", id)
      : await db.from("taxonomy_terms").insert(r);
    must(`taxonomy ${r.kind}:${r.key}`, res);
  }
  console.log("taxonomy terms:", rows.length);
}

// 2. regions
const regionId = new Map();
{
  for (const r of buildRegionRows()) {
    const parentId = r.parent_slug ? regionId.get(r.parent_slug) : null;
    const { data, error } = await db
      .from("regions")
      .upsert(
        {
          jurisdiction_code: r.jurisdiction_code,
          slug: r.slug,
          level: r.level,
          parent_id: parentId ?? null,
          name: r.name,
          sort_order: r.sort_order,
        },
        { onConflict: "jurisdiction_code,slug" },
      )
      .select("id, slug")
      .single();
    must(`region ${r.slug}`, { error });
    regionId.set(data.slug, data.id);
  }
  console.log("regions:", regionId.size);
}

// 3. developers
const devId = new Map();
{
  for (const d of buildDeveloperRows(projects)) {
    const { data, error } = await db
      .from("developers")
      .upsert(d, { onConflict: "code" })
      .select("id, code")
      .single();
    must(`developer ${d.code}`, { error });
    devId.set(data.code, data.id);
  }
  console.log("developers:", devId.size);
}

// 4. link projects + translations
{
  const { data: rows, error } = await db.from("catalog_projects").select("id, legacy_id");
  must("projects read", { error });
  const byLegacy = new Map(projects.map((p) => [p.id, p]));
  let linked = 0;
  let translated = 0;
  for (const r of rows ?? []) {
    const p = byLegacy.get(r.legacy_id);
    if (!p) continue;
    const upd = await db
      .from("catalog_projects")
      .update({
        jurisdiction_code: "TH",
        region_id: regionId.get(zoneSlug(p.zone)) ?? null,
        developer_id: devId.get(p.dt) ?? null,
      })
      .eq("id", r.id);
    must(`link ${r.legacy_id}`, upd);
    linked += 1;

    const t = ru[String(p.id)];
    if (!t) continue;
    const { data: cur } = await db
      .from("catalog_project_translations")
      .select("review_status")
      .eq("project_id", r.id)
      .eq("locale", "ru")
      .maybeSingle();
    if (cur?.review_status === "reviewed") continue; // never overwrite editor-approved text
    const up = await db.from("catalog_project_translations").upsert(
      {
        project_id: r.id,
        locale: "ru",
        description: t.desc,
        status_text: t.stT,
        completion_text: t.compQ,
        tags: t.tags,
        review_status: "machine",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,locale" },
    );
    must(`translation ${r.legacy_id}`, up);
    translated += 1;
  }
  console.log("projects linked:", linked, "· ru translations upserted:", translated);
}
