-- Phuket off-plan catalog — initial schema + RLS
-- Run in Supabase SQL editor or via supabase db push

create extension if not exists "pgcrypto";

-- Canonical zones for filters
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_en text not null,
  label_ru text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Developers
create table public.developers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ru text not null,
  created_at timestamptz not null default now()
);

-- Projects (mirror of app Project type)
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  slug text not null unique,
  name text not null,
  seg text not null,
  zone text not null,
  st_k text not null,
  rec text not null check (rec in ('BUY', 'WATCH', 'AVOID')),
  risk int not null check (risk between 1 and 5),
  dt text not null,
  handover_year int not null,
  beach text not null,
  ownership text not null,
  mgmt text not null,
  focus text not null,
  price_band text,
  yield_guess numeric,
  data_version int not null default 1,
  updated_at timestamptz not null default now(),
  published boolean not null default true
);

create index projects_zone_idx on public.projects (zone);
create index projects_rec_idx on public.projects (rec);
create index projects_dt_idx on public.projects (dt);

-- Header / disclaimers
create table public.catalog_meta (
  id smallint primary key default 1 check (id = 1),
  quarter_label text not null,
  total_value_bn_thb numeric,
  disclaimer_key text,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.zones enable row level security;
alter table public.developers enable row level security;
alter table public.projects enable row level security;
alter table public.catalog_meta enable row level security;

-- Anonymous read
create policy "zones_read_anon" on public.zones for select using (true);
create policy "developers_read_anon" on public.developers for select using (true);
create policy "projects_read_anon" on public.projects for select using (published = true);
create policy "catalog_meta_read_anon" on public.catalog_meta for select using (true);

-- Authenticated editors (role claim in JWT — adjust to your auth model)
create policy "projects_write_editor" on public.projects
  for all using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('editor', 'admin')
  )
  with check (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('editor', 'admin')
  );

create policy "zones_write_admin" on public.zones
  for all using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

create policy "developers_write_admin" on public.developers
  for all using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );

create policy "catalog_meta_write_admin" on public.catalog_meta
  for all using (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  )
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin'
  );
