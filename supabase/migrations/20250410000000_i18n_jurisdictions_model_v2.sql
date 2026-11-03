-- Model v2: jurisdictions, regions, taxonomy terms, developers, translations, unit price history,
-- organisation kinds (developer / broker / registry operator).
-- Additive and backwards compatible: nothing is dropped, existing rows keep working.

-- ---------------------------------------------------------------------------
-- Jurisdictions (a new market = a row + reference data, not a code fork)
-- ---------------------------------------------------------------------------
create table if not exists public.jurisdictions (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name jsonb not null,                       -- {"ru": "...", "en": "...", "local": "..."}
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  default_locale text not null default 'ru',
  locales text[] not null default array['ru','en'],
  timezone text not null default 'UTC',
  -- Legal regime facts (foreign ownership rules, transfer taxes, title documents, regulators,
  -- consent/privacy statute). Filled and reviewed by local counsel before activation.
  legal jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,  -- only active jurisdictions are shown publicly
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.jurisdictions (code, name, currency, default_locale, locales, timezone, is_active) values
  ('TH', '{"ru":"Таиланд","en":"Thailand","local":"ประเทศไทย"}', 'THB', 'ru', array['ru','en','th'], 'Asia/Bangkok', true),
  ('VN', '{"ru":"Вьетнам","en":"Vietnam","local":"Việt Nam"}', 'VND', 'ru', array['ru','en','vi'], 'Asia/Ho_Chi_Minh', false),
  ('KH', '{"ru":"Камбоджа","en":"Cambodia","local":"កម្ពុជា"}', 'USD', 'ru', array['ru','en','km'], 'Asia/Phnom_Penh', false)
on conflict (code) do nothing;

-- Hierarchical geography: country -> region -> district -> area
create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions (code) on delete cascade,
  parent_id uuid references public.regions (id) on delete cascade,
  slug text not null,
  level text not null default 'district' check (level in ('region', 'district', 'area')),
  name jsonb not null,                       -- {"ru": "...", "en": "..."}
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (jurisdiction_code, slug)
);
create index if not exists regions_parent_idx on public.regions (parent_id);

-- Controlled vocabularies with translations. jurisdiction_code NULL = global term.
create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text references public.jurisdictions (code) on delete cascade,
  kind text not null check (kind in ('seg','type','stK','beach','own','mgmt','focus','risk','rec')),
  key text not null,
  label jsonb not null,                      -- {"ru": "...", "en": "...", "ruShort": "..."}
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists taxonomy_terms_uq
  on public.taxonomy_terms (kind, key, coalesce(jurisdiction_code, '*'));

-- ---------------------------------------------------------------------------
-- Organisations: kinds + legal identity (developer / broker / registry operator)
-- ---------------------------------------------------------------------------
alter table public.orgs
  add column if not exists kind text not null default 'developer'
    check (kind in ('developer', 'broker', 'registry_operator')),
  add column if not exists jurisdiction_code text references public.jurisdictions (code),
  add column if not exists legal_name text,
  add column if not exists registration_no text,
  add column if not exists website text;

-- Developers become a first-class entity (was: free-text `dev` / `dt` in the payload).
alter table public.developers
  add column if not exists jurisdiction_code text references public.jurisdictions (code),
  add column if not exists legal_name text,
  add column if not exists registration_no text,
  add column if not exists website text,
  add column if not exists org_id uuid references public.orgs (id) on delete set null;

comment on table public.developers is 'Developer directory. `code` matches catalog payload field `dt`.';
comment on table public.zones is 'DEPRECATED: see public.regions.';
comment on table public.projects is 'DEPRECATED: use catalog_projects. Kept only until data is verified to be migrated.';

alter table public.catalog_projects
  add column if not exists jurisdiction_code text not null default 'TH' references public.jurisdictions (code),
  add column if not exists region_id uuid references public.regions (id) on delete set null,
  add column if not exists developer_id uuid references public.developers (id) on delete set null;
create index if not exists catalog_projects_jurisdiction_idx on public.catalog_projects (jurisdiction_code);

-- Multi-broker: a lead may be routed to a broker organisation.
alter table public.leads
  add column if not exists broker_org_id uuid references public.orgs (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Editorial translations (kept OUT of the moderated payload; edited by staff only)
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_project_translations (
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  description text not null default '',
  status_text text not null default '',
  completion_text text not null default '',
  tags text[] not null default '{}',
  review_status text not null default 'machine' check (review_status in ('machine', 'reviewed')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (project_id, locale)
);

-- ---------------------------------------------------------------------------
-- Inventory freshness + price history
-- ---------------------------------------------------------------------------
alter table public.project_units
  add column if not exists currency text not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  add column if not exists price_updated_at timestamptz not null default now(),
  add column if not exists source text not null default 'developer'
    check (source in ('developer', 'operator', 'import', 'api')),
  add column if not exists entered_by uuid references auth.users (id) on delete set null;

create table if not exists public.unit_price_history (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.project_units (id) on delete cascade,
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  price_thb numeric,
  currency text not null,
  status text not null,
  source text not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists unit_price_history_unit_idx on public.unit_price_history (unit_id, changed_at desc);

create or replace function public.project_units_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.price_thb is distinct from old.price_thb
     or new.status is distinct from old.status
     or new.currency is distinct from old.currency then
    new.price_updated_at := now();
    insert into public.unit_price_history (unit_id, project_id, price_thb, currency, status, source, changed_by)
    values (new.id, new.project_id, new.price_thb, new.currency, new.status, new.source, auth.uid());
  end if;
  return new;
end $$;

-- AFTER trigger needs the row id to exist; price_updated_at is set by a BEFORE trigger.
create or replace function public.project_units_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.price_thb is distinct from old.price_thb
     or new.status is distinct from old.status
     or new.currency is distinct from old.currency then
    new.price_updated_at := now();
  else
    new.price_updated_at := old.price_updated_at;  -- freshness cannot be forged
  end if;
  -- only staff may mark data as entered by the operator
  if auth.uid() is not null and not public.is_staff() and new.source = 'operator' then
    new.source := 'developer';
  end if;
  return new;
end $$;

drop trigger if exists project_units_touch on public.project_units;
create trigger project_units_touch before insert or update on public.project_units
  for each row execute function public.project_units_touch();

drop trigger if exists project_units_history on public.project_units;
create trigger project_units_history after insert or update on public.project_units
  for each row execute function public.project_units_track();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.jurisdictions enable row level security;
alter table public.regions enable row level security;
alter table public.taxonomy_terms enable row level security;
alter table public.catalog_project_translations enable row level security;
alter table public.unit_price_history enable row level security;

drop policy if exists "jurisdictions_public_read" on public.jurisdictions;
create policy "jurisdictions_public_read" on public.jurisdictions for select using (is_active);
drop policy if exists "jurisdictions_staff" on public.jurisdictions;
create policy "jurisdictions_staff" on public.jurisdictions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "regions_public_read" on public.regions;
create policy "regions_public_read" on public.regions for select using (true);
drop policy if exists "regions_staff" on public.regions;
create policy "regions_staff" on public.regions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "taxonomy_terms_public_read" on public.taxonomy_terms;
create policy "taxonomy_terms_public_read" on public.taxonomy_terms for select using (is_active);
drop policy if exists "taxonomy_terms_staff" on public.taxonomy_terms;
create policy "taxonomy_terms_staff" on public.taxonomy_terms
  for all using (public.is_staff()) with check (public.is_staff());

-- Translations are public only for published projects; written by staff (editors) only, so
-- partner-supplied text cannot reach the public site without moderation.
drop policy if exists "translations_public_read" on public.catalog_project_translations;
create policy "translations_public_read" on public.catalog_project_translations
  for select using (
    exists (
      select 1 from public.catalog_projects cp
      where cp.id = project_id and cp.is_published and cp.moderation_status = 'published'
    )
  );
drop policy if exists "translations_staff" on public.catalog_project_translations;
create policy "translations_staff" on public.catalog_project_translations
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "unit_history_staff" on public.unit_price_history;
create policy "unit_history_staff" on public.unit_price_history
  for select using (public.is_staff());
drop policy if exists "unit_history_partner" on public.unit_price_history;
create policy "unit_history_partner" on public.unit_price_history
  for select using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = unit_price_history.project_id and pr.id = auth.uid() and pr.role = 'partner'
    )
  );

-- developers/orgs public read of the directory (names only are non-sensitive)
drop policy if exists "developers_read_anon" on public.developers;
create policy "developers_read_anon" on public.developers for select using (true);

grant select on public.jurisdictions, public.regions, public.taxonomy_terms,
  public.catalog_project_translations, public.developers to anon, authenticated;
