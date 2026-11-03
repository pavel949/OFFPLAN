/**
 * Seed public.catalog_projects from data/seed/projects.json.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Run: node scripts/seed-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function slugify(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "project"
  );
}

function projectSlug(p) {
  return `${slugify(p.n)}-${p.id}`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (new URL(url).hostname !== "mfwbdfrrlckarktpwykf.supabase.co") {
  throw new Error(
    "Refusing source import outside the OFFPLAN production project",
  );
}
const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const raw = JSON.parse(
  fs.readFileSync(path.join(root, "data", "seed", "projects.json"), "utf8"),
);

const label = "OFFPLAN Q2 2026 source import 2026-11-03";
const { data: snapshot, error: readError } = await supabase
  .from("catalog_snapshots")
  .select("id")
  .eq("label", label)
  .maybeSingle();
if (readError) throw new Error(readError.message);
if (!snapshot) {
  const { error } = await supabase
    .from("catalog_snapshots")
    .insert({ label, quarter_label: "Q2 2026", projects: raw });
  if (error) throw new Error(error.message);
}

let ok = 0;
for (const p of raw) {
  const slug = projectSlug(p);
  const { error } = await supabase.from("catalog_projects").upsert(
    {
      legacy_id: p.id,
      slug,
      payload: p,
      is_published: false,
      moderation_status: "draft",
      org_id: null,
    },
    { onConflict: "legacy_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("Row", p.id, error.message);
  } else {
    ok += 1;
  }
}

console.log(
  "Processed catalog drafts (existing rows preserved):",
  ok,
  "/",
  raw.length,
);
if (ok !== raw.length) process.exitCode = 1;
