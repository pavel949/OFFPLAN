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

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

const raw = JSON.parse(
  fs.readFileSync(path.join(root, "data", "seed", "projects.json"), "utf8"),
);

let ok = 0;
for (const p of raw) {
  const slug = projectSlug(p);
  const { error } = await supabase.from("catalog_projects").upsert(
    {
      legacy_id: p.id,
      slug,
      payload: p,
      is_published: true,
      moderation_status: "published",
      org_id: null,
    },
    { onConflict: "legacy_id" },
  );
  if (error) {
    console.error("Row", p.id, error.message);
  } else {
    ok += 1;
  }
}

console.log("Upserted catalog_projects:", ok, "/", raw.length);

/* Optional: attach sample units to first project */
const { data: first } = await supabase
  .from("catalog_projects")
  .select("id")
  .eq("legacy_id", raw[0]?.id)
  .maybeSingle();

if (first?.id) {
  await supabase.from("project_units").delete().eq("project_id", first.id);
  const sample = [
    {
      project_id: first.id,
      label: "A-1201",
      bedrooms: 1,
      floor: 12,
      sqm: 45,
      price_thb: 9_500_000,
      status: "available",
      sort_order: 0,
    },
    {
      project_id: first.id,
      label: "B-0803",
      bedrooms: 2,
      floor: 8,
      sqm: 72,
      price_thb: 15_200_000,
      status: "reserved",
      sort_order: 1,
    },
  ];
  const { error: uerr } = await supabase.from("project_units").insert(sample);
  if (uerr) console.warn("Sample units:", uerr.message);
  else console.log("Inserted sample units for legacy_id", raw[0].id);

  await supabase.from("sales_campaigns").delete().eq("project_id", first.id);
  await supabase.from("sales_campaigns").insert({
    project_id: first.id,
    kind: "launch",
    label_en: "Sales launch Q2 2026",
    label_ru: "Старт продаж Q2 2026",
  });
  console.log("Inserted sample sales_campaign");
}
