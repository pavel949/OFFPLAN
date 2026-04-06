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
