// Generates the SQL that loads lib/geo-seed.ts and lib/country-content.ts into the database.
// Usage: node --experimental-strip-types scripts/gen-geo-migration.mjs > supabase/migrations/<ts>_geo_taxonomy_and_legal.sql
import { GEO } from "../lib/geo-seed.ts";
import { LEGAL_TOPICS } from "../lib/country-content.ts";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const j = (o) => `${q(JSON.stringify(o))}::jsonb`;
const out = [];
out.push(`-- Geography taxonomy (country -> region -> district) and country legal modules.
-- Generated from lib/geo-seed.ts and lib/country-content.ts. Idempotent.

create table if not exists public.legal_topics (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions (code) on delete cascade,
  topic text not null check (topic ~ '^[a-z_]{2,40}$'),
  title_ru text not null,
  title_en text not null default '',
  summary_ru text not null default '',
  summary_en text not null default '',
  points_ru jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('planned', 'draft', 'in_review', 'verified', 'outdated')),
  reviewed_by text,
  reviewed_at date,
  valid_until date,
  sort_order integer not null default 100,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jurisdiction_code, topic),
  -- a "verified" topic must name the lawyer and the dates
  check (status <> 'verified' or (reviewed_by is not null and reviewed_at is not null and valid_until is not null))
);
create index if not exists legal_topics_jurisdiction_idx on public.legal_topics (jurisdiction_code);

alter table public.legal_topics enable row level security;
create policy legal_topics_public_read on public.legal_topics for select using (is_published);
create policy legal_topics_staff on public.legal_topics for all to authenticated using (public.is_staff()) with check (public.is_staff());
revoke insert, update, delete, truncate, references, trigger on public.legal_topics from anon;
revoke truncate, references, trigger on public.legal_topics from authenticated;
`);

out.push("-- jurisdictions");
for (const c of GEO) {
  out.push(`update public.jurisdictions set name = ${j({ ru: c.ru, en: c.en, local: c.local })}, is_active = ${c.status === "active"} where code = ${q(c.code)};`);
}
out.push("\n-- regions and districts");
for (const c of GEO) {
  const regionRows = c.regions.map((r, i) => `(${q(r.slug)}, ${j({ ru: r.ru, en: r.en, local: r.local })}, ${(i + 1) * 10})`);
  if (regionRows.length)
    out.push(`insert into public.regions (jurisdiction_code, slug, level, name, sort_order) select ${q(c.code)}, v.slug, 'region', v.name, v.ord from (values ${regionRows.join(", ")}) as v(slug, name, ord) on conflict (jurisdiction_code, slug) do update set name = excluded.name;`);
  for (const r of c.regions) {
    const rows = r.locations.map((l, i) => `(${q(l.slug)}, ${j({ ru: l.ru, en: l.en })}, ${(i + 1) * 10})`);
    if (rows.length)
      out.push(`insert into public.regions (jurisdiction_code, slug, level, name, sort_order, parent_id) select ${q(c.code)}, v.slug, 'district', v.name, v.ord, p.id from (values ${rows.join(", ")}) as v(slug, name, ord) join public.regions p on p.jurisdiction_code = ${q(c.code)} and p.slug = ${q(r.slug)} on conflict (jurisdiction_code, slug) do update set name = excluded.name;`);
  }
}
out.push("\n-- legal topics (only inserted when missing: reviewed content is never overwritten)");
for (const t of LEGAL_TOPICS) {
  out.push(`insert into public.legal_topics (jurisdiction_code, topic, title_ru, summary_ru, points_ru, sources, status, sort_order) values (${q(t.country)}, ${q(t.topic)}, ${q(t.title)}, ${q(t.summary)}, ${j(t.points)}, ${j(t.sources)}, ${q(t.status)}, ${t.sort}) on conflict (jurisdiction_code, topic) do nothing;`);
}
console.log(out.join("\n"));
