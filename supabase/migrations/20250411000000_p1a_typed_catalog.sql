-- P1a (expand phase): typed projection of the catalogue + editorial assessments as a separate entity.
--
-- `catalog_projects.payload` stays the canonical document for now (nothing in the app reads these tables yet).
-- A trigger keeps `developments` and `assessments` in sync with it, so the data can be inspected, indexed and
-- quality-checked before the read path is switched (P1b) and the payload is split for good (contract phase).
-- Values that cannot be parsed become NULL and are listed in `parse_warnings`; nothing is guessed.

-- ---------------------------------------------------------------------------
-- Areas (replaces the ZONES constant in lib/taxonomy.ts as the FK target)
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name jsonb not null,           -- {"en": "...", "ru": "..."} (ru filled in by editors)
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.areas (slug, name, sort_order)
select lower(regexp_replace(z, '[^a-zA-Z0-9]+', '-', 'g')), jsonb_build_object('en', z), row_number() over (order by z) * 10
from unnest(array[
  'Bang Tao','Cape Panwa','Cape Yamu','Chalong','Cherngtalay','Kamala','Karon','Kata','Kathu','Koh Kaew','Laguna',
  'Layan','Mai Khao','NW Coast','Nai Harn','Nai Yang','Natai','Patong','Phuket Town','Rawai','Si Sunthon','Surin','Thalang'
]) as z
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Parsing helpers (immutable, unit-testable)
-- ---------------------------------------------------------------------------
-- '฿17.3M' -> 17300000 ; '฿10K' -> 10000 ; '฿1.2B' -> 1200000000
create or replace function public.parse_money_token(p_num text, p_suffix text)
returns numeric language sql immutable as $$
  select replace(p_num, ',', '')::numeric *
         case upper(coalesce(p_suffix, ''))
           when 'K' then 1e3 when 'M' then 1e6 when 'B' then 1e9 else 1 end;
$$;

create table if not exists public.developments (
  project_id uuid primary key references public.catalog_projects (id) on delete cascade,
  legacy_id int,
  slug text not null,
  name text not null,
  developer_name text,
  developer_code text,
  area_id uuid references public.areas (id),
  zone_raw text not null,                  -- original value, kept for audit / unmapped zones
  property_type text,
  segment text,
  construction_status text,
  beach_distance text,
  ownership text,
  management text,
  investment_focus text,
  -- price (THB). status: quoted | on_request (POA) | tba | unknown
  price_status text not null default 'unknown'
    check (price_status in ('quoted', 'on_request', 'tba', 'unknown')),
  price_from_thb numeric(18, 0),
  price_to_thb numeric(18, 0),
  price_open_ended boolean not null default false,   -- '฿315M+'
  units_total int,
  unit_size_min_sqm numeric(10, 1),
  unit_size_max_sqm numeric(10, 1),
  yield_min_pct numeric(5, 2),
  yield_max_pct numeric(5, 2),
  completion_year int,
  completion_text text,                              -- 'Dec 2026 / Q3 2027' stays human text
  parse_warnings text[] not null default '{}',
  synced_at timestamptz not null default now(),
  check (price_to_thb is null or price_from_thb is null or price_to_thb >= price_from_thb),
  check (unit_size_max_sqm is null or unit_size_min_sqm is null or unit_size_max_sqm >= unit_size_min_sqm),
  check (yield_max_pct is null or yield_min_pct is null or yield_max_pct >= yield_min_pct)
);

create unique index if not exists developments_slug_idx on public.developments (slug);
create index if not exists developments_area_idx on public.developments (area_id);
create index if not exists developments_status_idx on public.developments (construction_status);
create index if not exists developments_price_idx on public.developments (price_from_thb);
create index if not exists developments_completion_idx on public.developments (completion_year);

-- Editorial assessment: its own entity, never public by default (visibility is DATA, not an env flag).
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  methodology text not null default 'legacy-v1',
  rating numeric(3, 1) check (rating between 0 and 10),
  risk smallint check (risk between 1 and 3),
  label text check (label in ('BUY', 'WATCH', 'AVOID')),
  rationale text not null default '',
  sources text not null default '',
  visibility text not null default 'internal' check (visibility in ('internal', 'clients', 'public')),
  legal_reviewed_at timestamptz,
  is_current boolean not null default true,
  assessed_at timestamptz not null default now(),
  -- publishing an opinion requires an explicit legal sign-off
  check (visibility = 'internal' or legal_reviewed_at is not null)
);
create unique index if not exists assessments_current_idx on public.assessments (project_id) where is_current;
create index if not exists assessments_project_idx on public.assessments (project_id, assessed_at desc);

-- ---------------------------------------------------------------------------
-- Sync: payload -> developments / assessments
-- ---------------------------------------------------------------------------
create or replace function public.sync_catalog_facts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p jsonb := new.payload;
  warn text[] := '{}';
  m text[];
  v_status text := 'unknown';
  v_from numeric; v_to numeric; v_open boolean := false;
  v_units int; v_smin numeric; v_smax numeric; v_ymin numeric; v_ymax numeric;
  v_area uuid;
  v_zone text := coalesce(p ->> 'zone', '');
  pt text := btrim(coalesce(p ->> 'pT', ''));
  us text := btrim(coalesce(p ->> 'units', ''));
  sz text := btrim(coalesce(p ->> 'unitSzM2', ''));
  yl text := btrim(coalesce(p ->> 'yield', ''));
  cur public.assessments%rowtype;
  n_rating numeric; n_risk smallint; n_label text; n_rationale text; n_sources text;
begin
  select id into v_area from public.areas where name ->> 'en' = v_zone;
  if v_area is null then warn := array_append(warn, 'zone_unmapped'); end if;

  -- price
  if upper(pt) = 'POA' then v_status := 'on_request';
  elsif upper(pt) = 'TBA' then v_status := 'tba';
  else
    m := regexp_match(pt, '^฿\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMBkmb]?)\s*(\+?)\s*$');
    if m is not null then
      v_status := 'quoted'; v_from := public.parse_money_token(m[1], m[2]); v_open := m[3] = '+';
    else
      m := regexp_match(pt, '^฿\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMBkmb]?)\s*[–-]\s*฿\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMBkmb]?)\s*$');
      if m is not null then
        v_status := 'quoted'; v_from := public.parse_money_token(m[1], m[2]); v_to := public.parse_money_token(m[3], m[4]);
      elsif pt <> '' then warn := array_append(warn, 'price_unparsed');
      end if;
    end if;
  end if;

  -- units
  m := regexp_match(us, '^~?\s*([0-9][0-9,]*)');
  if m is not null then v_units := replace(m[1], ',', '')::int;
  elsif us <> '' and us <> 'н/д' and upper(us) <> 'TBA' then warn := array_append(warn, 'units_unparsed');
  end if;

  -- unit sizes
  m := regexp_match(sz, '^([0-9][0-9,]*(?:\.[0-9]+)?)\s*[–-]\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*sqm');
  if m is not null then
    v_smin := replace(m[1], ',', '')::numeric; v_smax := replace(m[2], ',', '')::numeric;
  else
    m := regexp_match(sz, '^([0-9][0-9,]*(?:\.[0-9]+)?)\+?\s*sqm');
    if m is not null then v_smin := replace(m[1], ',', '')::numeric; v_smax := v_smin;
    elsif sz <> '' and sz <> 'н/д' then warn := array_append(warn, 'unit_size_unparsed');
    end if;
  end if;

  -- yield
  m := regexp_match(yl, '^([0-9]+(?:\.[0-9]+)?)\s*[–-]\s*([0-9]+(?:\.[0-9]+)?)\s*%$');
  if m is not null then v_ymin := m[1]::numeric; v_ymax := m[2]::numeric;
  else
    m := regexp_match(yl, '^([0-9]+(?:\.[0-9]+)?)\s*%$');
    if m is not null then v_ymin := m[1]::numeric; v_ymax := v_ymin;
    elsif yl <> '' then warn := array_append(warn, 'yield_unparsed');
    end if;
  end if;

  insert into public.developments as d (
    project_id, legacy_id, slug, name, developer_name, developer_code, area_id, zone_raw,
    property_type, segment, construction_status, beach_distance, ownership, management, investment_focus,
    price_status, price_from_thb, price_to_thb, price_open_ended, units_total,
    unit_size_min_sqm, unit_size_max_sqm, yield_min_pct, yield_max_pct,
    completion_year, completion_text, parse_warnings, synced_at
  ) values (
    new.id, new.legacy_id, new.slug, coalesce(p ->> 'n', new.slug), p ->> 'dev', p ->> 'dt', v_area, v_zone,
    p ->> 'type', p ->> 'seg', p ->> 'stK', p ->> 'beach', p ->> 'own', p ->> 'mgmt', p ->> 'focus',
    v_status, v_from, v_to, v_open, v_units,
    v_smin, v_smax, v_ymin, v_ymax,
    nullif(p ->> 'compY', '')::int, p ->> 'compQ', warn, now()
  )
  on conflict (project_id) do update set
    legacy_id = excluded.legacy_id, slug = excluded.slug, name = excluded.name,
    developer_name = excluded.developer_name, developer_code = excluded.developer_code,
    area_id = excluded.area_id, zone_raw = excluded.zone_raw,
    property_type = excluded.property_type, segment = excluded.segment,
    construction_status = excluded.construction_status, beach_distance = excluded.beach_distance,
    ownership = excluded.ownership, management = excluded.management, investment_focus = excluded.investment_focus,
    price_status = excluded.price_status, price_from_thb = excluded.price_from_thb,
    price_to_thb = excluded.price_to_thb, price_open_ended = excluded.price_open_ended,
    units_total = excluded.units_total, unit_size_min_sqm = excluded.unit_size_min_sqm,
    unit_size_max_sqm = excluded.unit_size_max_sqm, yield_min_pct = excluded.yield_min_pct,
    yield_max_pct = excluded.yield_max_pct, completion_year = excluded.completion_year,
    completion_text = excluded.completion_text, parse_warnings = excluded.parse_warnings, synced_at = now();

  -- assessment: history is kept; a new row is written only when the editorial content actually changed
  n_rating := nullif(p ->> 'rat', '')::numeric;
  n_risk := nullif(p ->> 'risk', '')::smallint;
  n_label := p ->> 'rec';
  n_rationale := coalesce(p ->> 'recText', '');
  n_sources := coalesce(p ->> 'src', '');
  select * into cur from public.assessments where project_id = new.id and is_current;
  if not found then
    insert into public.assessments (project_id, rating, risk, label, rationale, sources)
    values (new.id, n_rating, n_risk, n_label, n_rationale, n_sources);
  elsif cur.rating is distinct from n_rating or cur.risk is distinct from n_risk
     or cur.label is distinct from n_label or cur.rationale is distinct from n_rationale
     or cur.sources is distinct from n_sources then
    update public.assessments set is_current = false where id = cur.id;
    insert into public.assessments (project_id, methodology, rating, risk, label, rationale, sources, visibility, legal_reviewed_at)
    values (new.id, cur.methodology, n_rating, n_risk, n_label, n_rationale, n_sources, cur.visibility, cur.legal_reviewed_at);
  end if;
  return new;
end $$;

drop trigger if exists catalog_projects_sync_facts on public.catalog_projects;
create trigger catalog_projects_sync_facts
  after insert or update of payload, slug, legacy_id on public.catalog_projects
  for each row execute function public.sync_catalog_facts();

-- Backfill from the current payloads (fires the trigger).
update public.catalog_projects set payload = payload;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.areas enable row level security;
alter table public.developments enable row level security;
alter table public.assessments enable row level security;

drop policy if exists "areas_public_read" on public.areas;
create policy "areas_public_read" on public.areas for select using (is_active);
drop policy if exists "areas_staff" on public.areas;
create policy "areas_staff" on public.areas for all using (public.is_staff()) with check (public.is_staff());

-- Facts are public once the project is public; partners see their own organisation's rows.
drop policy if exists "developments_public_read" on public.developments;
create policy "developments_public_read" on public.developments
  for select using (public.is_public_project(project_id));
drop policy if exists "developments_staff" on public.developments;
create policy "developments_staff" on public.developments
  for all using (public.is_staff()) with check (public.is_staff());

-- Assessments: staff only for now. Publication is a data decision (visibility + legal sign-off), exposed later via a view.
drop policy if exists "assessments_staff" on public.assessments;
create policy "assessments_staff" on public.assessments
  for all using (public.is_staff()) with check (public.is_staff());

comment on table public.developments is 'Typed projection of catalog_projects.payload (P1a, kept in sync by trigger). NULL = unknown, see parse_warnings.';
comment on table public.assessments is 'Editorial rating/risk/label per project. Internal by default; publishing requires legal_reviewed_at.';
