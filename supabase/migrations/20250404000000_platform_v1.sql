-- Platform v1: orgs, catalog_projects (JSON payload), units, campaigns, deals, moderation, profiles
-- Compatible with existing zones/developers/catalog_meta from earlier migrations

create extension if not exists "pgcrypto";

-- Organizations (developers)
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ru text not null,
  code text unique,
  profile_draft jsonb,
  profile_published jsonb,
  org_moderation_status text not null default 'published'
    check (org_moderation_status in ('draft', 'pending_review', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'buyer'
    check (role in ('admin', 'editor', 'partner', 'buyer')),
  org_id uuid references public.orgs (id) on delete set null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Canonical project row: full legacy payload + moderation
create table if not exists public.catalog_projects (
  id uuid primary key default gen_random_uuid(),
  legacy_id int unique,
  slug text not null unique,
  org_id uuid references public.orgs (id) on delete set null,
  payload jsonb not null,
  draft_payload jsonb,
  moderation_status text not null default 'published'
    check (moderation_status in ('draft', 'pending_review', 'published', 'rejected')),
  is_published boolean not null default true,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_projects_org_idx on public.catalog_projects (org_id);
create index if not exists catalog_projects_published_idx on public.catalog_projects (is_published, moderation_status);

create table if not exists public.project_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  external_key text,
  label text not null,
  bedrooms int,
  floor int,
  sqm numeric,
  price_thb numeric,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold')),
  plan_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_units_project_idx on public.project_units (project_id);

create table if not exists public.sales_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  kind text not null check (kind in ('launch', 'sale', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  label_en text not null default '',
  label_ru text not null default '',
  created_at timestamptz not null default now()
);

-- Deals for commission tracking
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid,
  project_id uuid references public.catalog_projects (id) on delete set null,
  unit_id uuid references public.project_units (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'reserved', 'won', 'lost', 'cancelled')),
  commission_amount_thb numeric,
  currency text not null default 'THB',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Correction requests (IE vs partner data)
create table if not exists public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  message text not null default '',
  status text not null default 'open' check (status in ('open', 'granted', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_submissions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project', 'org')),
  entity_id uuid not null,
  submitted_by uuid references auth.users (id) on delete set null,
  snapshot jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text not null default '',
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Buyer favorites
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

-- Extend leads if table exists (from prior migration)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'leads') then
    alter table public.leads add column if not exists project_uuid uuid references public.catalog_projects (id) on delete set null;
    alter table public.leads add column if not exists unit_uuid uuid references public.project_units (id) on delete set null;
    alter table public.leads add column if not exists partner_code text;
    alter table public.leads add column if not exists utm jsonb;
    alter table public.leads add column if not exists deal_id uuid references public.deals (id) on delete set null;
  end if;
end $$;

-- RLS
alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.catalog_projects enable row level security;
alter table public.project_units enable row level security;
alter table public.sales_campaigns enable row level security;
alter table public.deals enable row level security;
alter table public.correction_requests enable row level security;
alter table public.moderation_submissions enable row level security;
alter table public.favorites enable row level security;

-- Helper: is staff
-- Public read published catalog
drop policy if exists "catalog_projects_public_read" on public.catalog_projects;
create policy "catalog_projects_public_read" on public.catalog_projects
  for select using (is_published = true and moderation_status = 'published');

-- Authenticated read own drafts (partner)
drop policy if exists "catalog_projects_partner_read" on public.catalog_projects;
create policy "catalog_projects_partner_read" on public.catalog_projects
  for select using (
    auth.role() = 'authenticated'
    and org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Staff all
drop policy if exists "catalog_projects_staff_all" on public.catalog_projects;
create policy "catalog_projects_staff_all" on public.catalog_projects
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

-- Partner: update own org projects (draft)
drop policy if exists "catalog_projects_partner_update" on public.catalog_projects;
create policy "catalog_projects_partner_update" on public.catalog_projects
  for update using (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

drop policy if exists "catalog_projects_partner_insert" on public.catalog_projects;
create policy "catalog_projects_partner_insert" on public.catalog_projects
  for insert with check (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

-- project_units: public read if parent published
drop policy if exists "project_units_public_read" on public.project_units;
create policy "project_units_public_read" on public.project_units
  for select using (
    exists (
      select 1 from public.catalog_projects cp
      where cp.id = project_id and cp.is_published and cp.moderation_status = 'published'
    )
  );

drop policy if exists "project_units_staff" on public.project_units;
create policy "project_units_staff" on public.project_units
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- sales_campaigns public read
drop policy if exists "sales_campaigns_public_read" on public.sales_campaigns;
create policy "sales_campaigns_public_read" on public.sales_campaigns
  for select using (
    exists (
      select 1 from public.catalog_projects cp
      where cp.id = project_id and cp.is_published and cp.moderation_status = 'published'
    )
  );

drop policy if exists "sales_campaigns_staff" on public.sales_campaigns;
create policy "sales_campaigns_staff" on public.sales_campaigns
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- profiles: users read/update self
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_staff_read" on public.profiles;
create policy "profiles_staff_read" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- orgs: public read minimal
drop policy if exists "orgs_public_read" on public.orgs;
create policy "orgs_public_read" on public.orgs
  for select using (org_moderation_status = 'published');

drop policy if exists "orgs_staff" on public.orgs;
create policy "orgs_staff" on public.orgs
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- favorites
drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- deals: staff only
drop policy if exists "deals_staff" on public.deals;
create policy "deals_staff" on public.deals
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- correction_requests
drop policy if exists "correction_partner" on public.correction_requests;
create policy "correction_partner" on public.correction_requests
  for all using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  )
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

drop policy if exists "correction_staff" on public.correction_requests;
create policy "correction_staff" on public.correction_requests
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- moderation_submissions staff
drop policy if exists "moderation_staff" on public.moderation_submissions;
create policy "moderation_staff" on public.moderation_submissions
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

drop policy if exists "moderation_partner_insert" on public.moderation_submissions;
create policy "moderation_partner_insert" on public.moderation_submissions
  for insert with check (
    submitted_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

-- Link deals to leads when both exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'leads')
     and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'deals') then
    alter table public.deals drop constraint if exists deals_lead_fk;
    alter table public.deals
      add constraint deals_lead_fk foreign key (lead_id) references public.leads (id) on delete set null;
  end if;
end $$;

-- Optional: in Supabase Dashboard create trigger on auth.users to insert into public.profiles on signup.
