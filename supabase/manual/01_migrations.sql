-- OFFPLAN: миграции, которых не хватает в проекте mfwbdfrrlckarktpwykf (SQL Editor -> New query -> Run).
-- В проекте уже применены: init, catalog_snapshots_and_payload, leads. Здесь - всё остальное, в порядке версий.
-- Запускать ОДИН раз, целиком. Всё в одной транзакции: ошибка -> ничего не применится.
begin;

-- ===================================================================
-- 20250404000000_platform_v1.sql
-- ===================================================================
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

-- ===================================================================
-- 20250406100000_moderation_enhancements.sql
-- ===================================================================
-- Moderation: baseline for diff, partner read own submissions, block edits while pending

alter table public.moderation_submissions
  add column if not exists baseline_snapshot jsonb;

alter table public.correction_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.correction_requests
  add column if not exists admin_note text not null default '';

-- Partner update: not while project has pending submission; not when row is pending_review
drop policy if exists "catalog_projects_partner_update" on public.catalog_projects;
create policy "catalog_projects_partner_update" on public.catalog_projects
  for update using (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
    and moderation_status in ('draft', 'rejected', 'published')
    and not exists (
      select 1 from public.moderation_submissions ms
      where ms.entity_type = 'project'
        and ms.entity_id = catalog_projects.id
        and ms.status = 'pending'
    )
  );

-- Partner: read own moderation rows
drop policy if exists "moderation_partner_read_own" on public.moderation_submissions;
create policy "moderation_partner_read_own" on public.moderation_submissions
  for select using (
    submitted_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );

-- ===================================================================
-- 20250406100001_moderation_partner_read_scope.sql
-- ===================================================================
-- Partners in same org can see moderation rows for their projects / org profile
drop policy if exists "moderation_partner_read_own" on public.moderation_submissions;

create policy "moderation_partner_read_scope" on public.moderation_submissions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_id is not null
        and (
          (
            entity_type = 'project'
            and exists (
              select 1 from public.catalog_projects cp
              where cp.id = entity_id
                and cp.org_id = p.org_id
            )
          )
          or (
            entity_type = 'org'
            and entity_id = p.org_id
          )
        )
    )
  );

-- ===================================================================
-- 20250407100000_admin_brain.sql
-- ===================================================================
-- Admin "brain": methodology settings, project documents, WhatsApp text imports

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('memo', 'marketing', 'legal', 'plan', 'other')),
  title text not null default '',
  storage_path text not null,
  mime text not null default 'application/octet-stream',
  file_size int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_idx on public.project_documents (project_id);

create table if not exists public.whatsapp_ingests (
  id uuid primary key default gen_random_uuid(),
  source_label text not null default 'paste',
  raw_text text not null,
  parsed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
alter table public.project_documents enable row level security;
alter table public.whatsapp_ingests enable row level security;

drop policy if exists "platform_settings_staff" on public.platform_settings;
create policy "platform_settings_staff" on public.platform_settings
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

drop policy if exists "project_documents_staff" on public.project_documents;
create policy "project_documents_staff" on public.project_documents
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

drop policy if exists "whatsapp_ingests_staff" on public.whatsapp_ingests;
create policy "whatsapp_ingests_staff" on public.whatsapp_ingests
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

insert into public.platform_settings (key, value)
values (
  'rating_methodology',
  jsonb_build_object(
    'ru', 'Опишите шкалу rat (0–10), risk (1–3), rec (BUY/WATCH/AVOID) и источники данных.',
    'en', 'Describe rat, risk, rec methodology and data sources.',
    'weights', jsonb_build_object(
      'rat', '0–10 composite (liquidity, developer, zone, product)',
      'risk', '1–3 (low to high)',
      'rec', 'Editorial label after methodology'
    )
  )
)
on conflict (key) do nothing;

insert into public.platform_settings (key, value)
values (
  'catalog_headline',
  jsonb_build_object('totalValueBnTHB', 71, 'quarterLabel', 'Q2 2026')
)
on conflict (key) do nothing;

-- Private bucket for PDFs, sheets, marketing files (server uploads via service role)
insert into storage.buckets (id, name, public)
values ('project-docs', 'project-docs', false)
on conflict (id) do nothing;

-- ===================================================================
-- 20250408000000_marketplace_phases_0_5.sql
-- ===================================================================
-- Phases 0-5: marketplace (partner roles, updates, subscriptions, analytics, webhooks, partner RLS)

alter table public.profiles
  add column if not exists partner_role text
  check (partner_role is null or partner_role in ('owner', 'sales'));

alter table public.catalog_projects
  add column if not exists data_confirmed_at timestamptz;

alter table public.project_units
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.catalog_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('project', 'unit', 'campaign', 'update')),
  entity_id uuid not null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists catalog_audit_log_entity_idx on public.catalog_audit_log (entity_type, entity_id, created_at desc);

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  kind text not null default 'news'
    check (kind in ('news', 'construction', 'milestone')),
  title_en text not null default '',
  title_ru text not null default '',
  body_en text not null default '',
  body_ru text not null default '',
  media_urls jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_updates_project_idx on public.project_updates (project_id, published_at desc);

create table if not exists public.project_subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references public.catalog_projects (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  session_id text,
  path text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_project_idx on public.analytics_events (project_id, created_at desc);

create table if not exists public.org_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  url text not null,
  secret text not null default '',
  events text[] not null default array['lead.created']::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists org_webhook_endpoints_org_idx on public.org_webhook_endpoints (org_id);

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  unique (org_id)
);

alter table public.catalog_audit_log enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_subscriptions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.org_webhook_endpoints enable row level security;
alter table public.billing_customers enable row level security;

drop policy if exists "catalog_audit_staff" on public.catalog_audit_log;
create policy "catalog_audit_staff" on public.catalog_audit_log
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

drop policy if exists "project_updates_public_read" on public.project_updates;
create policy "project_updates_public_read" on public.project_updates
  for select using (
    is_published
    and exists (
      select 1 from public.catalog_projects cp
      where cp.id = project_id and cp.is_published and cp.moderation_status = 'published'
    )
  );

drop policy if exists "project_updates_partner_all" on public.project_updates;
create policy "project_updates_partner_all" on public.project_updates
  for all using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_updates.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  )
  with check (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_updates.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "project_updates_staff" on public.project_updates;
create policy "project_updates_staff" on public.project_updates
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

drop policy if exists "project_subscriptions_own" on public.project_subscriptions;
create policy "project_subscriptions_own" on public.project_subscriptions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "analytics_events_deny" on public.analytics_events;
create policy "analytics_events_deny" on public.analytics_events
  for select using (false);

drop policy if exists "org_webhook_partner_read" on public.org_webhook_endpoints;
create policy "org_webhook_partner_read" on public.org_webhook_endpoints
  for select using (
    exists (
      select 1 from public.profiles pr
      where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = org_webhook_endpoints.org_id
    )
  );

drop policy if exists "org_webhook_staff" on public.org_webhook_endpoints;
create policy "org_webhook_staff" on public.org_webhook_endpoints
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

drop policy if exists "billing_customers_staff" on public.billing_customers;
create policy "billing_customers_staff" on public.billing_customers
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

drop policy if exists "project_units_partner_rw" on public.project_units;
create policy "project_units_partner_rw" on public.project_units
  for insert with check (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "project_units_partner_update" on public.project_units;
create policy "project_units_partner_update" on public.project_units
  for update using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  )
  with check (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "project_units_partner_delete" on public.project_units;
create policy "project_units_partner_delete" on public.project_units
  for delete using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "sales_campaigns_partner_insert" on public.sales_campaigns;
create policy "sales_campaigns_partner_insert" on public.sales_campaigns
  for insert with check (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = sales_campaigns.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "sales_campaigns_partner_update" on public.sales_campaigns;
create policy "sales_campaigns_partner_update" on public.sales_campaigns
  for update using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = sales_campaigns.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  )
  with check (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = sales_campaigns.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

drop policy if exists "sales_campaigns_partner_delete" on public.sales_campaigns;
create policy "sales_campaigns_partner_delete" on public.sales_campaigns
  for delete using (
    exists (
      select 1 from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = sales_campaigns.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

-- ===================================================================
-- 20250409000000_security_hardening.sql
-- ===================================================================
-- Security hardening (audit P0/P1)
--  * fixes infinite RLS recursion on public.profiles (policy referenced profiles from profiles)
--  * blocks privilege escalation via self-update of profiles.role / org_id / partner_role
--  * blocks partners from writing published state (payload / moderation_status / is_published) directly
--  * closes anonymous reads of catalog_snapshots and anonymous inserts into leads
--  * stops exposing webhook secrets to partners
--  * adds profile auto-creation on signup, partner lead read scope, public read of two platform settings

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER bypass RLS => no recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'editor')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: no recursion, no self-promotion
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_staff_read" on public.profiles;
create policy "profiles_staff_read" on public.profiles
  for select using (public.is_staff());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for service_role / direct DB connections => trusted server code.
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.partner_role is distinct from old.partner_role
       or new.id is distinct from old.id then
      raise exception 'profiles: role, org_id and partner_role can only be changed by an administrator'
        using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Auto-create a buyer profile for every new auth user (partners/staff are promoted by an admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'buyer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, role)
select u.id, 'buyer' from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- catalog_projects: partners may only touch draft_payload & data_confirmed_at
-- ---------------------------------------------------------------------------
create or replace function public.catalog_projects_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.moderation_status := 'draft';
    new.is_published := false;
    new.legacy_id := null;
    return new;
  end if;

  if new.payload is distinct from old.payload
     or new.moderation_status is distinct from old.moderation_status
     or new.is_published is distinct from old.is_published
     or new.org_id is distinct from old.org_id
     or new.slug is distinct from old.slug
     or new.legacy_id is distinct from old.legacy_id
     or new.lat is distinct from old.lat
     or new.lng is distinct from old.lng then
    raise exception 'catalog_projects: partners may only edit draft_payload and confirm data; publishing goes through moderation'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists catalog_projects_guard on public.catalog_projects;
create trigger catalog_projects_guard before insert or update on public.catalog_projects
  for each row execute function public.catalog_projects_guard();

-- ---------------------------------------------------------------------------
-- Second recursion: catalog_projects -> moderation_submissions -> catalog_projects.
-- Break the cycle with a SECURITY DEFINER lookup.
-- ---------------------------------------------------------------------------
create or replace function public.has_pending_submission(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.moderation_submissions ms
    where ms.entity_type = 'project' and ms.entity_id = p_project_id and ms.status = 'pending'
  );
$$;
revoke all on function public.has_pending_submission(uuid) from public;
grant execute on function public.has_pending_submission(uuid) to authenticated, service_role;

drop policy if exists "catalog_projects_partner_update" on public.catalog_projects;
create policy "catalog_projects_partner_update" on public.catalog_projects
  for update using (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
    and moderation_status in ('draft', 'rejected', 'published')
    and not public.has_pending_submission(catalog_projects.id)
  );

-- ---------------------------------------------------------------------------
-- Anonymous exposure
-- ---------------------------------------------------------------------------
drop policy if exists "catalog_snapshots_read_anon" on public.catalog_snapshots;
drop policy if exists "catalog_snapshots_write_editor" on public.catalog_snapshots;
create policy "catalog_snapshots_staff" on public.catalog_snapshots
  for all using (public.is_staff()) with check (public.is_staff());

-- Leads are inserted by trusted server code (service role) after captcha / rate limiting.
drop policy if exists "leads_insert_anon" on public.leads;
drop policy if exists "leads_read_editor" on public.leads;
drop policy if exists "leads_update_editor" on public.leads;
create policy "leads_staff" on public.leads
  for all using (public.is_staff()) with check (public.is_staff());

-- Partners read leads for their own organisation's projects.
drop policy if exists "leads_partner_read" on public.leads;
create policy "leads_partner_read" on public.leads
  for select using (
    exists (
      select 1
      from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = leads.project_uuid
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

-- Webhook secret must not be readable by partners (staff manage it).
drop policy if exists "org_webhook_partner_read" on public.org_webhook_endpoints;

-- Public (anon-key) reads for the two settings shown on the public site.
drop policy if exists "platform_settings_public_read" on public.platform_settings;
create policy "platform_settings_public_read" on public.platform_settings
  for select using (key in ('rating_methodology', 'catalog_headline'));

-- ---------------------------------------------------------------------------
-- Audit log: allow more entity types (moderation, org, correction, lead)
-- ---------------------------------------------------------------------------
alter table public.catalog_audit_log drop constraint if exists catalog_audit_log_entity_type_check;
alter table public.catalog_audit_log
  add constraint catalog_audit_log_entity_type_check
  check (entity_type in ('project', 'unit', 'campaign', 'update', 'org', 'moderation', 'correction', 'lead'));

-- ---------------------------------------------------------------------------
-- Legacy tables are not read by the app any more (catalog_projects is the single source of truth)
-- ---------------------------------------------------------------------------
comment on table public.projects is 'DEPRECATED: use catalog_projects. Kept only until data is verified to be migrated.';
comment on table public.zones is 'DEPRECATED: canonical lists live in lib/taxonomy.ts.';
comment on table public.developers is 'DEPRECATED: canonical lists live in lib/taxonomy.ts.';

-- ===================================================================
-- 20250409000001_leads_consent.sql
-- ===================================================================
-- Consent evidence + routing/index improvements for leads
alter table public.leads add column if not exists consent_at timestamptz;
alter table public.leads add column if not exists consent_version text;
create index if not exists leads_project_uuid_idx on public.leads (project_uuid);
create index if not exists leads_email_created_idx on public.leads (lower(email), created_at desc);

-- ===================================================================
-- 20250414000000_p0_public_surface.sql
-- ===================================================================
-- P0: close the public column leak and make moderation decisions atomic.
--
--  1. Row-level policies cannot hide columns: with `catalog_projects_public_read` the (public) anon key could
--     read `draft_payload` and `payload.rec / payload.recText` straight from PostgREST. Public access now goes
--     ONLY through the view `public_catalog_projects`; the base table keeps just the partner/staff policies.
--  2. Child tables (units, campaigns, updates) used a sub-select on catalog_projects that ran under the caller's
--     RLS. They now use a SECURITY DEFINER helper so they keep working without a public policy on the base table.
--  3. approve / reject / correction-grant become single-transaction SQL functions (no manual "revert" in app code).

-- ---------------------------------------------------------------------------
-- 1. Helper + child-table policies
-- ---------------------------------------------------------------------------
create or replace function public.is_public_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.catalog_projects cp
    where cp.id = p_project_id and cp.is_published and cp.moderation_status = 'published'
  );
$$;
revoke all on function public.is_public_project(uuid) from public;
grant execute on function public.is_public_project(uuid) to anon, authenticated, service_role;

drop policy if exists "project_units_public_read" on public.project_units;
create policy "project_units_public_read" on public.project_units
  for select using (public.is_public_project(project_id));

drop policy if exists "sales_campaigns_public_read" on public.sales_campaigns;
create policy "sales_campaigns_public_read" on public.sales_campaigns
  for select using (public.is_public_project(project_id));

drop policy if exists "project_updates_public_read" on public.project_updates;
create policy "project_updates_public_read" on public.project_updates
  for select using (is_published and public.is_public_project(project_id));

-- ---------------------------------------------------------------------------
-- 2. Public view (the ONLY public contract for catalogue rows)
-- ---------------------------------------------------------------------------
-- Owned by the migration role => bypasses RLS on the base table; the WHERE clause is the public filter.
-- Editorial opinion is neutralised in the payload (rec -> WATCH, recText -> ''), `draft_payload` is not exposed.
-- Real labels are only read by trusted server code (service role) when publishing them is explicitly enabled.
create or replace view public.public_catalog_projects as
  select
    cp.id,
    cp.legacy_id,
    cp.slug,
    (cp.payload || jsonb_build_object('rec', 'WATCH', 'recText', '')) as payload,
    cp.lat,
    cp.lng,
    cp.data_confirmed_at,
    cp.updated_at
  from public.catalog_projects cp
  where cp.is_published and cp.moderation_status = 'published';

revoke all on public.public_catalog_projects from public;
grant select on public.public_catalog_projects to anon, authenticated, service_role;

drop policy if exists "catalog_projects_public_read" on public.catalog_projects;
revoke all on public.catalog_projects from anon;

comment on view public.public_catalog_projects is
  'Public contract for catalogue rows. Never expose draft_payload or editorial rec/recText here.';

-- ---------------------------------------------------------------------------
-- 3. Atomic moderation functions (called with the service role only)
-- ---------------------------------------------------------------------------
create or replace function public.moderation_approve(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sub public.moderation_submissions%rowtype;
  n int;
begin
  select * into sub from public.moderation_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found' using errcode = 'P0002'; end if;
  if sub.status <> 'pending' then raise exception 'already_processed' using errcode = 'P0001'; end if;

  if sub.entity_type = 'project' then
    update public.catalog_projects
       set payload = sub.snapshot, draft_payload = null,
           moderation_status = 'published', is_published = true, updated_at = now()
     where id = sub.entity_id;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'entity_not_found' using errcode = 'P0002'; end if;
  elsif sub.entity_type = 'org' then
    update public.orgs
       set profile_published = sub.snapshot, profile_draft = null,
           org_moderation_status = 'published', updated_at = now()
     where id = sub.entity_id;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'entity_not_found' using errcode = 'P0002'; end if;
  end if;

  update public.moderation_submissions
     set status = 'approved', reviewed_at = now()
   where id = p_submission_id;

  insert into public.catalog_audit_log (entity_type, entity_id, actor_id, action, diff)
  values ('moderation', p_submission_id, null, 'moderation_approved',
          jsonb_build_object('entity_type', sub.entity_type, 'entity_id', sub.entity_id));

  return jsonb_build_object('entity_type', sub.entity_type, 'entity_id', sub.entity_id);
end $$;

create or replace function public.moderation_reject(p_submission_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sub public.moderation_submissions%rowtype;
  note text := left(coalesce(p_note, ''), 4000);
begin
  select * into sub from public.moderation_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found' using errcode = 'P0002'; end if;
  if sub.status <> 'pending' then raise exception 'already_processed' using errcode = 'P0001'; end if;

  if sub.entity_type = 'project' then
    update public.catalog_projects
       set moderation_status = 'rejected', updated_at = now()
     where id = sub.entity_id and moderation_status = 'pending_review';
  end if;

  update public.moderation_submissions
     set status = 'rejected', reviewer_note = note, reviewed_at = now()
   where id = p_submission_id;

  insert into public.catalog_audit_log (entity_type, entity_id, actor_id, action, diff)
  values ('moderation', p_submission_id, null, 'moderation_rejected',
          jsonb_build_object('note', left(note, 500)));

  return jsonb_build_object('entity_type', sub.entity_type, 'entity_id', sub.entity_id);
end $$;

create or replace function public.correction_grant(p_request_id uuid, p_admin_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  req public.correction_requests%rowtype;
  proj public.catalog_projects%rowtype;
begin
  select * into req from public.correction_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if req.status <> 'open' then raise exception 'already_processed' using errcode = 'P0001'; end if;

  select * into proj from public.catalog_projects where id = req.project_id for update;
  if not found then raise exception 'entity_not_found' using errcode = 'P0002'; end if;
  if proj.org_id is not null and proj.org_id <> req.org_id then
    raise exception 'project_owned_by_other_org' using errcode = 'P0001';
  end if;

  update public.catalog_projects
     set org_id = req.org_id,
         draft_payload = coalesce(draft_payload, payload),
         updated_at = now()
   where id = req.project_id;

  update public.correction_requests
     set status = 'granted', admin_note = left(coalesce(p_admin_note, ''), 4000), updated_at = now()
   where id = p_request_id;

  insert into public.catalog_audit_log (entity_type, entity_id, actor_id, action, diff)
  values ('correction', p_request_id, null, 'correction_granted',
          jsonb_build_object('project_id', req.project_id, 'org_id', req.org_id));

  return jsonb_build_object('project_id', req.project_id, 'org_id', req.org_id);
end $$;

revoke all on function public.moderation_approve(uuid) from public, anon, authenticated;
revoke all on function public.moderation_reject(uuid, text) from public, anon, authenticated;
revoke all on function public.correction_grant(uuid, text) from public, anon, authenticated;
grant execute on function public.moderation_approve(uuid) to service_role;
grant execute on function public.moderation_reject(uuid, text) to service_role;
grant execute on function public.correction_grant(uuid, text) to service_role;

-- ===================================================================
-- 20250414000001_p1a_typed_catalog.sql
-- ===================================================================
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

-- ===================================================================
-- 20250414000002_fk_indexes.sql
-- ===================================================================
-- Indexes for foreign-key columns that had none (found by schema audit).
-- Hot paths: project page (campaigns/subscriptions/favorites by project), RLS sub-selects on profiles.org_id,
-- partner views (correction_requests, deals), cascading deletes. All small tables today; cheap insurance.
create index if not exists profiles_org_idx on public.profiles (org_id);
create index if not exists sales_campaigns_project_idx on public.sales_campaigns (project_id);
create index if not exists favorites_project_idx on public.favorites (project_id);
create index if not exists project_subscriptions_project_idx on public.project_subscriptions (project_id);
create index if not exists correction_requests_project_idx on public.correction_requests (project_id);
create index if not exists correction_requests_org_idx on public.correction_requests (org_id);
create index if not exists deals_lead_idx on public.deals (lead_id);
create index if not exists deals_project_idx on public.deals (project_id);
create index if not exists deals_unit_idx on public.deals (unit_id);
create index if not exists leads_deal_idx on public.leads (deal_id);
create index if not exists leads_unit_idx on public.leads (unit_uuid);
create index if not exists moderation_submissions_entity_idx on public.moderation_submissions (entity_type, entity_id, status);
create index if not exists moderation_submissions_submitted_by_idx on public.moderation_submissions (submitted_by);
create index if not exists project_updates_created_by_idx on public.project_updates (created_by);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id);
create index if not exists catalog_audit_log_actor_idx on public.catalog_audit_log (actor_id);

-- ===================================================================
-- 20250414000003_p0_compat_registry_i18n.sql
-- ===================================================================
-- P0 compatibility for features that live on other branches (i18n translations, verification registry).
-- No-op until those tables/columns exist, so it is safe to ship before they merge and to run after.
--
-- After P0 the base table catalog_projects has no public RLS policy, so any policy that sub-selects it
-- under the caller's rights silently returns nothing for anonymous visitors. Fix them with the
-- SECURITY DEFINER helper, and expose the verification columns through the public view.
do $$
begin
  if to_regclass('public.catalog_project_translations') is not null then
    drop policy if exists "translations_public_read" on public.catalog_project_translations;
    create policy "translations_public_read" on public.catalog_project_translations
      for select using (public.is_public_project(project_id));
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_projects' and column_name = 'verification_level'
  ) then
    -- columns are appended, so CREATE OR REPLACE VIEW is allowed
    create or replace view public.public_catalog_projects as
      select
        cp.id,
        cp.legacy_id,
        cp.slug,
        (cp.payload || jsonb_build_object('rec', 'WATCH', 'recText', '')) as payload,
        cp.lat,
        cp.lng,
        cp.data_confirmed_at,
        cp.updated_at,
        cp.verification_level,
        cp.verified_at,
        cp.verification_expires_at
      from public.catalog_projects cp
      where cp.is_published and cp.moderation_status = 'published';
    grant select on public.public_catalog_projects to anon, authenticated, service_role;
  end if;
end $$;

commit;
