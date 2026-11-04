-- Forward consolidation of PR #3. Prior production migrations are already applied.
-- Replaces its four unmerged migration files; do not reintroduce the old versions.

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


-- Developer portal: partners must be able to READ the units of their own projects (draft or
-- published) — UPDATE/DELETE by id also needs a SELECT policy to see the rows.

drop policy if exists "project_units_partner_read" on public.project_units;
create policy "project_units_partner_read" on public.project_units
  for select using (
    exists (
      select 1
      from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

-- Billing groundwork: active (not sold) units per organisation. security_invoker => RLS applies,
-- so partners see only their own organisation and staff see all.
create or replace view public.org_active_units with (security_invoker = true) as
select
  cp.org_id,
  count(*) filter (where u.status <> 'sold') as active_units,
  count(*) filter (where u.status <> 'sold' and u.price_updated_at < now() - interval '30 days') as expired_units,
  max(u.price_updated_at) as last_price_update
from public.project_units u
join public.catalog_projects cp on cp.id = u.project_id
group by cp.org_id;

grant select on public.org_active_units to authenticated;

-- ---------------------------------------------------------------------------
-- "Prices are still valid" confirmation: refreshes price_updated_at of all active units of a
-- project without changing data. Allowed for staff, for partners of the owning org, and for
-- trusted server code (service role). The BEFORE trigger honours a transaction-local flag that
-- only this function can set.
-- ---------------------------------------------------------------------------
create or replace function public.project_units_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.price_thb is distinct from old.price_thb
     or new.status is distinct from old.status
     or new.currency is distinct from old.currency
     or current_setting('offplan.confirm_prices', true) = 'on' then
    new.price_updated_at := now();
  else
    new.price_updated_at := old.price_updated_at;  -- freshness cannot be forged
  end if;
  if auth.uid() is not null and not public.is_staff() and new.source = 'operator' then
    new.source := 'developer';
  end if;
  return new;
end $$;

create or replace function public.confirm_project_prices(p_project_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is not null and not public.is_staff() and not exists (
    select 1
    from public.catalog_projects cp
    join public.profiles pr on pr.org_id = cp.org_id
    where cp.id = p_project_id and pr.id = auth.uid() and pr.role = 'partner'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform set_config('offplan.confirm_prices', 'on', true);
  update public.project_units set price_updated_at = now()
   where project_id = p_project_id and status <> 'sold';
  get diagnostics n = row_count;
  perform set_config('offplan.confirm_prices', 'off', true);
  return n;
end $$;

revoke all on function public.confirm_project_prices(uuid) from public;
grant execute on function public.confirm_project_prices(uuid) to authenticated, service_role;


-- Verification registry: levels L0–L2, cases, checklist items, evidence, messages (right of reply),
-- public event log, conflict-of-interest rules and the two-person rule enforced in the database.
--
-- Separation of duties (product decision: registry is separate from brokerage):
--   * decisions are taken ONLY by users with profiles.role = 'reviewer' (not by admin/editor);
--   * the reviewer who verified checklist items cannot take the final decision (four eyes);
--   * a reviewer with a commercial interest in the project (or who recused) cannot act on it;
--   * the verification fee never depends on the outcome (fee_status only tracks payment).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'editor', 'partner', 'buyer', 'reviewer'));

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'reviewer');
$$;

-- who may READ registry internals: reviewers and platform staff (transparency), never decide
create or replace function public.can_read_registry()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('reviewer', 'admin', 'editor'));
$$;

revoke all on function public.is_reviewer() from public;
revoke all on function public.can_read_registry() from public;
-- anon needs EXECUTE too: RLS policies call these helpers, and they must evaluate to false (empty
-- result) for anonymous callers rather than fail with "permission denied".
grant execute on function public.is_reviewer() to anon, authenticated, service_role;
grant execute on function public.can_read_registry() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Project-level result (effective level is computed at read time: expired => 0)
-- ---------------------------------------------------------------------------
alter table public.catalog_projects
  add column if not exists verification_level smallint not null default 0 check (verification_level between 0 and 2),
  add column if not exists verified_at timestamptz,
  add column if not exists verification_expires_at timestamptz;

-- ---------------------------------------------------------------------------
-- Checklist templates per jurisdiction and level
-- ---------------------------------------------------------------------------
create table if not exists public.verification_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions (code),
  level smallint not null check (level in (1, 2)),
  version int not null default 1,
  items jsonb not null,           -- [{"key","title":{"ru","en"},"hint":{"ru","en"},"required":true}]
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (jurisdiction_code, level, version)
);

-- Generic categories (no legal conclusions): counsel of each jurisdiction refines the wording.
insert into public.verification_checklist_templates (jurisdiction_code, level, items) values
('TH', 1, $j$[
 {"key":"developer_registration","required":true,
  "title":{"ru":"Регистрация застройщика","en":"Developer registration"},
  "hint":{"ru":"Выписка из реестра юридических лиц, состав учредителей и директоров, уставный капитал.","en":"Company registry extract, shareholders and directors, registered capital."}},
 {"key":"land_title","required":true,
  "title":{"ru":"Документ на землю","en":"Land title"},
  "hint":{"ru":"Правоустанавливающий документ на участок: вид титула, собственник, отсутствие обременений.","en":"Title document for the plot: type, owner, absence of encumbrances."}},
 {"key":"permits","required":true,
  "title":{"ru":"Разрешения на строительство","en":"Construction permits"},
  "hint":{"ru":"Разрешение на строительство и экологическая оценка, если она требуется для проекта.","en":"Building permit and environmental assessment where required."}},
 {"key":"financials","required":true,
  "title":{"ru":"Финансовая отчётность застройщика","en":"Developer financials"},
  "hint":{"ru":"Аудированная или публичная отчётность за последние периоды.","en":"Audited or public financial statements for recent periods."}},
 {"key":"track_record","required":true,
  "title":{"ru":"Завершённые проекты и сроки сдачи","en":"Completed projects and delivery record"},
  "hint":{"ru":"Список сданных проектов с плановыми и фактическими датами сдачи.","en":"List of delivered projects with planned and actual handover dates."}},
 {"key":"contract_template","required":true,
  "title":{"ru":"Типовой договор и график платежей","en":"Sales contract and payment schedule"},
  "hint":{"ru":"Типовой договор купли-продажи, график платежей, штрафные санкции за просрочку сдачи.","en":"Standard sale contract, payment schedule, delay penalties."}},
 {"key":"escrow_guarantees","required":true,
  "title":{"ru":"Эскроу и гарантии возврата платежей","en":"Escrow and refund guarantees"},
  "hint":{"ru":"Условия хранения платежей покупателей и гарантии их возврата.","en":"How buyer payments are held and how refunds are guaranteed."}},
 {"key":"progress_evidence","required":false,
  "title":{"ru":"Подтверждение хода строительства","en":"Construction progress evidence"},
  "hint":{"ru":"Датированные фото и видео стройплощадки.","en":"Dated photos and video of the site."}}
]$j$::jsonb),
('TH', 2, $j$[
 {"key":"independent_legal_opinion","required":true,
  "title":{"ru":"Независимое юридическое заключение","en":"Independent legal opinion"},
  "hint":{"ru":"Заключение независимой юридической фирмы, не связанной с застройщиком и платформой.","en":"Opinion of an independent law firm unrelated to the developer and the platform."}},
 {"key":"title_search_report","required":true,
  "title":{"ru":"Проверка титула в государственном реестре","en":"Title search at the land registry"},
  "hint":{"ru":"Отчёт о проверке права на участок и обременений по данным реестра.","en":"Registry search of ownership and encumbrances."}},
 {"key":"site_inspection_report","required":true,
  "title":{"ru":"Отчёт о выезде на объект","en":"Site inspection report"},
  "hint":{"ru":"Отчёт независимого инженера или эксперта о фактическом состоянии стройки.","en":"Independent engineer or expert report on actual construction status."}}
]$j$::jsonb)
on conflict (jurisdiction_code, level, version) do nothing;

-- ---------------------------------------------------------------------------
-- Cases, items, messages, recusals, commercial interests, public events
-- ---------------------------------------------------------------------------
create table if not exists public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  target_level smallint not null check (target_level in (1, 2)),
  template_id uuid not null references public.verification_checklist_templates (id),
  status text not null default 'draft'
    check (status in ('draft','submitted','in_review','changes_requested','approved','rejected','withdrawn')),
  assigned_reviewer uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  public_summary text not null default '',   -- shown in the public log; required on decision
  -- Fee is cost recovery and independent of the outcome: only payment status is tracked.
  fee_status text not null default 'unpaid' check (fee_status in ('unpaid','invoiced','paid','waived')),
  submitted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists verification_cases_one_open
  on public.verification_cases (project_id, target_level)
  where status in ('draft','submitted','in_review','changes_requested');

create table if not exists public.verification_items (
  case_id uuid not null references public.verification_cases (id) on delete cascade,
  item_key text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','provided','verified','failed','na')),
  evidence jsonb not null default '[]'::jsonb,   -- [{"path","filename","size","uploaded_at"}]
  reviewer_note text not null default '',
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  primary key (case_id, item_key)
);

create table if not exists public.verification_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.verification_cases (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete set null,
  author_side text not null check (author_side in ('developer','reviewer')),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.verification_recusals (
  case_id uuid not null references public.verification_cases (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (length(reason) >= 5),
  created_at timestamptz not null default now(),
  primary key (case_id, reviewer_id)
);

-- Commercial interests (e.g. a broker agreement) — staff declares; leads routed to a broker count too.
create table if not exists public.project_commercial_interests (
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  org_id uuid not null references public.orgs (id) on delete cascade,
  kind text not null default 'broker_agreement' check (kind in ('broker_agreement','deal','other')),
  note text not null default '',
  declared_at timestamptz not null default now(),
  primary key (project_id, org_id, kind)
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  case_id uuid references public.verification_cases (id) on delete set null,
  event text not null check (event in ('submitted','changes_requested','approved','rejected','revoked','expired','withdrawn')),
  level_from smallint,
  level_to smallint,
  summary text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists verification_events_project_idx on public.verification_events (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Conflict-of-interest check (SECURITY DEFINER so it sees all rows)
-- ---------------------------------------------------------------------------
create or replace function public.reviewer_conflicted(p_case uuid, p_reviewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.verification_recusals r where r.case_id = p_case and r.reviewer_id = p_reviewer)
    or exists (
      select 1
      from public.verification_cases c
      join public.profiles pr on pr.id = p_reviewer
      where c.id = p_case and pr.org_id is not null
        and (
          pr.org_id = c.org_id                                                      -- reviewer works for the developer
          or exists (select 1 from public.project_commercial_interests i
                     where i.project_id = c.project_id and i.org_id = pr.org_id)     -- declared interest
          or exists (select 1 from public.leads l
                     where l.project_uuid = c.project_id and l.broker_org_id = pr.org_id) -- brokers leads of this project
        )
    );
$$;
revoke all on function public.reviewer_conflicted(uuid, uuid) from public;
grant execute on function public.reviewer_conflicted(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Workflow functions (the only way to change case state)
-- ---------------------------------------------------------------------------
create or replace function public.start_verification_case(p_project uuid, p_level smallint)
returns uuid language plpgsql security definer set search_path = public as $$
declare cp record; tpl record; cid uuid;
begin
  select id, org_id, jurisdiction_code, verification_level, verification_expires_at
    into cp from public.catalog_projects where id = p_project;
  if cp.id is null then raise exception 'project not found'; end if;
  if auth.uid() is null or not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = cp.org_id
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_level = 2 and not (cp.verification_level >= 1 and cp.verification_expires_at > now()) then
    raise exception 'level 2 requires a valid level 1';
  end if;
  select * into tpl from public.verification_checklist_templates t
   where t.jurisdiction_code = cp.jurisdiction_code and t.level = p_level and t.is_active
   order by t.version desc limit 1;
  if tpl.id is null then raise exception 'no checklist template for this jurisdiction/level'; end if;

  insert into public.verification_cases (project_id, org_id, target_level, template_id, created_by)
  values (p_project, cp.org_id, p_level, tpl.id, auth.uid()) returning id into cid;
  insert into public.verification_items (case_id, item_key, required)
  select cid, i->>'key', coalesce((i->>'required')::boolean, true)
  from jsonb_array_elements(tpl.items) i;
  return cid;
end $$;

create or replace function public.attach_verification_evidence(p_case uuid, p_item text, p_path text, p_filename text, p_size int)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or auth.uid() is null or not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = c.org_id
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if c.status not in ('draft','changes_requested') then raise exception 'case is not editable'; end if;
  update public.verification_items
     set evidence = evidence || jsonb_build_array(jsonb_build_object('path', p_path, 'filename', p_filename, 'size', p_size, 'uploaded_at', now())),
         status = 'provided'
   where case_id = p_case and item_key = p_item and status in ('pending','provided','failed');
  if not found then raise exception 'item not found or already verified'; end if;
end $$;

create or replace function public.submit_verification_case(p_case uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or auth.uid() is null or not exists (
    select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = c.org_id
  ) then raise exception 'not allowed' using errcode = '42501'; end if;
  if c.status not in ('draft','changes_requested') then raise exception 'case is not editable'; end if;
  if exists (select 1 from public.verification_items i
             where i.case_id = p_case and i.required and i.status not in ('provided','verified')) then
    raise exception 'all required checklist items need evidence';
  end if;
  update public.verification_cases set status = 'submitted', submitted_at = now(), updated_at = now() where id = p_case;
  insert into public.verification_events (project_id, case_id, event, level_from, summary)
  select c.project_id, p_case, 'submitted', cp.verification_level, 'Заявка на верификацию подана'
    from public.catalog_projects cp where cp.id = c.project_id;
end $$;

create or replace function public.claim_verification_case(p_case uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or c.status <> 'submitted' then raise exception 'case is not awaiting review'; end if;
  if public.reviewer_conflicted(p_case, auth.uid()) then
    raise exception 'conflict of interest: recuse and let another reviewer take this case' using errcode = '42501';
  end if;
  update public.verification_cases set status = 'in_review', assigned_reviewer = auth.uid(), updated_at = now() where id = p_case;
end $$;

create or replace function public.recuse_from_case(p_case uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  insert into public.verification_recusals (case_id, reviewer_id, reason) values (p_case, auth.uid(), p_reason)
  on conflict (case_id, reviewer_id) do update set reason = excluded.reason;
  -- release the case if this reviewer was assigned
  update public.verification_cases
     set status = case when status = 'in_review' then 'submitted' else status end, assigned_reviewer = null, updated_at = now()
   where id = p_case and assigned_reviewer = auth.uid();
end $$;

create or replace function public.review_verification_item(p_case uuid, p_item text, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if p_status not in ('verified','failed','na','pending') then raise exception 'bad status'; end if;
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or c.status <> 'in_review' or c.assigned_reviewer is distinct from auth.uid() then
    raise exception 'only the assigned reviewer can check items of a case in review' using errcode = '42501';
  end if;
  if public.reviewer_conflicted(p_case, auth.uid()) then raise exception 'conflict of interest' using errcode = '42501'; end if;
  update public.verification_items
     set status = p_status, reviewer_note = left(coalesce(p_note, ''), 2000),
         verified_by = case when p_status in ('verified','failed','na') then auth.uid() else null end,
         verified_at = case when p_status in ('verified','failed','na') then now() else null end
   where case_id = p_case and item_key = p_item;
  if not found then raise exception 'item not found'; end if;
end $$;

create or replace function public.request_verification_changes(p_case uuid, p_summary text)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or c.status <> 'in_review' or c.assigned_reviewer is distinct from auth.uid() then
    raise exception 'only the assigned reviewer can request changes' using errcode = '42501';
  end if;
  update public.verification_cases set status = 'changes_requested', assigned_reviewer = null, updated_at = now() where id = p_case;
  insert into public.verification_events (project_id, case_id, event, summary)
  values (c.project_id, p_case, 'changes_requested', left(coalesce(p_summary, ''), 1000));
end $$;

-- Final decision: four eyes + conflict check + checklist completeness, atomically.
create or replace function public.decide_verification(p_case uuid, p_decision text, p_public_summary text)
returns void language plpgsql security definer set search_path = public as $$
declare c record; cp record; lvl_from smallint;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'bad decision'; end if;
  if length(coalesce(p_public_summary, '')) < 20 then raise exception 'public summary is required (min 20 chars)'; end if;
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or c.status <> 'in_review' then raise exception 'case is not in review'; end if;
  if public.reviewer_conflicted(p_case, auth.uid()) then raise exception 'conflict of interest' using errcode = '42501'; end if;
  -- four eyes: the decider must not be the one who checked the items
  if auth.uid() = c.assigned_reviewer
     or exists (select 1 from public.verification_items i where i.case_id = p_case and i.verified_by = auth.uid()) then
    raise exception 'four-eyes rule: the final decision must be taken by a different reviewer' using errcode = '42501';
  end if;
  select * into cp from public.catalog_projects where id = c.project_id;
  lvl_from := cp.verification_level;

  if p_decision = 'approved' then
    if exists (select 1 from public.verification_items i
               where i.case_id = p_case and i.required and i.status not in ('verified','na')) then
      raise exception 'all required items must be verified before approval';
    end if;
    if c.target_level = 2 and not (cp.verification_level >= 1 and cp.verification_expires_at > now()) then
      raise exception 'level 2 requires a valid level 1';
    end if;
  end if;

  update public.verification_cases
     set status = p_decision, decided_by = auth.uid(), decided_at = now(), public_summary = p_public_summary, updated_at = now()
   where id = p_case;

  if p_decision = 'approved' then
    perform set_config('offplan.registry_write', 'on', true);
    update public.catalog_projects
       set verification_level = c.target_level, verified_at = now(), verification_expires_at = now() + interval '12 months'
     where id = c.project_id;
    perform set_config('offplan.registry_write', 'off', true);
  end if;

  insert into public.verification_events (project_id, case_id, event, level_from, level_to, summary)
  values (c.project_id, p_case, p_decision, lvl_from,
          case when p_decision = 'approved' then c.target_level else lvl_from end, p_public_summary);
end $$;

create or replace function public.revoke_verification(p_project uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare lvl smallint;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if length(coalesce(p_reason, '')) < 20 then raise exception 'reason is required (min 20 chars)'; end if;
  select verification_level into lvl from public.catalog_projects where id = p_project;
  if coalesce(lvl, 0) = 0 then raise exception 'project is not verified'; end if;
  perform set_config('offplan.registry_write', 'on', true);
  update public.catalog_projects set verification_level = 0, verification_expires_at = now() where id = p_project;
  perform set_config('offplan.registry_write', 'off', true);
  insert into public.verification_events (project_id, event, level_from, level_to, summary)
  values (p_project, 'revoked', lvl, 0, p_reason);
end $$;

create or replace function public.post_verification_message(p_case uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare c record; side text;
begin
  select * into c from public.verification_cases where id = p_case;
  if c.id is null or auth.uid() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = c.org_id) then
    side := 'developer';
  elsif public.is_reviewer() and not public.reviewer_conflicted(p_case, auth.uid()) then
    side := 'reviewer';
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.verification_messages (case_id, author_id, author_side, body) values (p_case, auth.uid(), side, p_body);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'start_verification_case(uuid, smallint)', 'attach_verification_evidence(uuid, text, text, text, int)',
    'submit_verification_case(uuid)', 'claim_verification_case(uuid)', 'recuse_from_case(uuid, text)',
    'review_verification_item(uuid, text, text, text)', 'request_verification_changes(uuid, text)',
    'decide_verification(uuid, text, text)', 'revoke_verification(uuid, text)', 'post_verification_message(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Guards: nobody but the registry functions may change verification columns
-- ---------------------------------------------------------------------------
create or replace function public.catalog_projects_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- verification result is written only by registry functions (flag) or trusted server code
  if tg_op = 'UPDATE' and auth.uid() is not null
     and coalesce(current_setting('offplan.registry_write', true), '') <> 'on'
     and (new.verification_level is distinct from old.verification_level
          or new.verified_at is distinct from old.verified_at
          or new.verification_expires_at is distinct from old.verification_expires_at) then
    raise exception 'verification result can only be changed through the registry' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null and not public.is_staff() then
    new.verification_level := 0; new.verified_at := null; new.verification_expires_at := null;
  end if;

  if auth.uid() is null or public.is_staff() or coalesce(current_setting('offplan.registry_write', true), '') = 'on' then
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
     or new.lng is distinct from old.lng
     or new.jurisdiction_code is distinct from old.jurisdiction_code
     or new.region_id is distinct from old.region_id
     or new.developer_id is distinct from old.developer_id then
    raise exception 'catalog_projects: partners may only edit draft_payload and confirm data; publishing goes through moderation'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- Decided cases are immutable (audit): block direct updates of terminal states
create or replace function public.verification_cases_immutable()
returns trigger language plpgsql as $$
begin
  if old.status in ('approved','rejected','withdrawn') and (new.status is distinct from old.status or new.decided_by is distinct from old.decided_by or new.public_summary is distinct from old.public_summary) then
    raise exception 'decided verification cases are immutable';
  end if;
  return new;
end $$;
drop trigger if exists verification_cases_immutable on public.verification_cases;
create trigger verification_cases_immutable before update on public.verification_cases
  for each row execute function public.verification_cases_immutable();

-- ---------------------------------------------------------------------------
-- RLS: reads only; all writes go through the functions above (service role bypasses)
-- ---------------------------------------------------------------------------
alter table public.verification_checklist_templates enable row level security;
alter table public.verification_cases enable row level security;
alter table public.verification_items enable row level security;
alter table public.verification_messages enable row level security;
alter table public.verification_recusals enable row level security;
alter table public.project_commercial_interests enable row level security;
alter table public.verification_events enable row level security;

create or replace function public.partner_of_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'partner' and pr.org_id = p_org);
$$;
revoke all on function public.partner_of_org(uuid) from public;
grant execute on function public.partner_of_org(uuid) to anon, authenticated, service_role;

-- templates and the public log are public (methodology and change history are transparent)
create policy "vtemplates_public_read" on public.verification_checklist_templates for select using (is_active);
create policy "vevents_public_read" on public.verification_events for select using (true);

create policy "vcases_partner_read" on public.verification_cases for select using (public.partner_of_org(org_id));
create policy "vcases_registry_read" on public.verification_cases for select using (public.can_read_registry());

create policy "vitems_partner_read" on public.verification_items for select using (
  exists (select 1 from public.verification_cases c where c.id = case_id and public.partner_of_org(c.org_id)));
create policy "vitems_registry_read" on public.verification_items for select using (public.can_read_registry());

create policy "vmsg_partner_read" on public.verification_messages for select using (
  exists (select 1 from public.verification_cases c where c.id = case_id and public.partner_of_org(c.org_id)));
create policy "vmsg_registry_read" on public.verification_messages for select using (public.can_read_registry());

create policy "vrecusals_registry_read" on public.verification_recusals for select using (public.can_read_registry());

create policy "vinterests_registry_read" on public.project_commercial_interests for select using (public.can_read_registry());
create policy "vinterests_staff_write" on public.project_commercial_interests
  for all using (public.is_staff()) with check (public.is_staff());

grant select on public.verification_checklist_templates, public.verification_events to anon, authenticated;
grant select on public.verification_cases, public.verification_items, public.verification_messages,
  public.verification_recusals, public.project_commercial_interests to authenticated;

-- private bucket for evidence documents (accessed only via server code with the service role)
insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;


-- Deals & commissions: configurable agreements (developer → broker), broker terms (broker ↔ platform),
-- deal plan snapshot, milestone ledger, payments, protected state transitions, party-scoped visibility.

-- ---------------------------------------------------------------------------
-- Configurable terms
-- ---------------------------------------------------------------------------
create table if not exists public.commission_agreements (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  developer_org_id uuid not null references public.orgs (id) on delete cascade,
  broker_org_id uuid references public.orgs (id) on delete cascade,      -- null = any broker
  project_id uuid references public.catalog_projects (id) on delete cascade, -- null = all projects of the developer
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),            -- validated by lib/commission/terms.ts
  exclusive boolean not null default false,                               -- leads of the project are routed to this broker
  visibility text not null default 'parties' check (visibility in ('parties', 'public_to_brokers')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  valid_from date not null default current_date,
  valid_to date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists commission_agreements_dev_idx on public.commission_agreements (developer_org_id, status);

create table if not exists public.broker_terms (
  id uuid primary key default gen_random_uuid(),
  broker_org_id uuid not null references public.orgs (id) on delete cascade,
  developer_org_id uuid references public.orgs (id) on delete cascade,    -- null = default for all developers
  platform_fee jsonb not null default '{"type":"none"}'::jsonb,           -- validated by platformFeeSchema
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  valid_from date not null default current_date,
  valid_to date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists broker_terms_broker_idx on public.broker_terms (broker_org_id, status);

-- ---------------------------------------------------------------------------
-- Deals (extend the existing table)
-- ---------------------------------------------------------------------------
alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals
  add constraint deals_status_check check (status in ('open', 'reserved', 'contract_signed', 'won', 'lost', 'cancelled'));

alter table public.deals
  add column if not exists developer_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists broker_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists referrer_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists referral_percent numeric check (referral_percent is null or referral_percent between 0 and 100),
  add column if not exists agreement_id uuid references public.commission_agreements (id) on delete set null,
  add column if not exists broker_terms_id uuid references public.broker_terms (id) on delete set null,
  add column if not exists contract_price numeric check (contract_price is null or contract_price >= 0),
  add column if not exists net_price numeric check (net_price is null or net_price >= 0),
  add column if not exists price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  add column if not exists fx_rate numeric check (fx_rate is null or fx_rate > 0),
  add column if not exists commission_currency text check (commission_currency is null or commission_currency ~ '^[A-Z]{3}$'),
  add column if not exists commission_gross numeric,
  add column if not exists platform_fee_total numeric,
  add column if not exists referral_fee_total numeric,
  add column if not exists broker_net numeric,
  add column if not exists plan_snapshot jsonb,        -- terms used at the time of planning (immutable audit)
  add column if not exists reserved_at timestamptz,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists lost_reason text not null default '',
  add column if not exists clawback_review boolean not null default false;

create index if not exists deals_developer_idx on public.deals (developer_org_id);
create index if not exists deals_broker_idx on public.deals (broker_org_id);

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  milestone text check (milestone in ('reserved', 'contract_signed', 'won')),   -- null for adjustments
  kind text not null check (kind in ('commission', 'platform_fee', 'referral_fee', 'payout', 'adjustment', 'clawback')),
  payer_org uuid references public.orgs (id) on delete set null,                 -- null = platform operator
  payee_org uuid references public.orgs (id) on delete set null,                 -- null = platform operator
  amount numeric not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  delay_days int not null default 0,
  status text not null default 'expected' check (status in ('expected', 'due', 'paid', 'void')),
  due_at timestamptz,
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  paid_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_deal_idx on public.ledger_entries (deal_id);
create index if not exists ledger_entries_payer_idx on public.ledger_entries (payer_org);
create index if not exists ledger_entries_payee_idx on public.ledger_entries (payee_org);

create table if not exists public.ledger_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  amount numeric not null check (amount > 0),
  reference text not null default '',
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  note text not null default '',
  actor uuid references auth.users (id) on delete set null,   -- null for the shared admin login / service role
  created_at timestamptz not null default now()
);
create index if not exists deal_events_deal_idx on public.deal_events (deal_id, created_at);

-- Paid money is never rewritten or deleted
create or replace function public.ledger_entries_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.paid_amount > 0 then raise exception 'ledger entries with payments cannot be deleted'; end if;
    return old;
  end if;
  if old.paid_amount > 0 and (
       new.amount is distinct from old.amount or new.currency is distinct from old.currency
       or new.payer_org is distinct from old.payer_org or new.payee_org is distinct from old.payee_org
       or new.kind is distinct from old.kind or new.milestone is distinct from old.milestone or new.deal_id is distinct from old.deal_id) then
    raise exception 'ledger entries with payments are immutable';
  end if;
  if new.paid_amount < old.paid_amount then raise exception 'paid amount cannot decrease'; end if;
  return new;
end $$;
drop trigger if exists ledger_entries_guard on public.ledger_entries;
create trigger ledger_entries_guard before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_guard();

-- ---------------------------------------------------------------------------
-- Functions (finance actor = platform staff or trusted server code with the service role)
-- ---------------------------------------------------------------------------
create or replace function public.finance_actor()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_staff();
$$;
revoke all on function public.finance_actor() from public;
grant execute on function public.finance_actor() to anon, authenticated, service_role;

create or replace function public.deal_rank(p_status text)
returns int language sql immutable as $$
  select case p_status when 'open' then 0 when 'reserved' then 1 when 'contract_signed' then 2 when 'won' then 3
                       when 'lost' then -1 when 'cancelled' then -1 else null end;
$$;

-- Store the computed plan: totals, snapshot and the ledger. Allowed until money has been paid.
create or replace function public.set_deal_plan(p_deal uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare d record; e jsonb; r int; ts timestamptz;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.id is null then raise exception 'deal not found'; end if;
  if d.status in ('lost', 'cancelled', 'won') then raise exception 'deal is closed'; end if;
  if exists (select 1 from public.ledger_entries l where l.deal_id = p_deal and l.paid_amount > 0) then
    raise exception 'payments already recorded: use adjustments instead of re-planning';
  end if;

  delete from public.ledger_entries where deal_id = p_deal and status in ('expected', 'due') and kind not in ('adjustment', 'clawback');

  update public.deals set
    commission_currency = p_plan #>> '{totals,currency}',
    commission_gross = (p_plan #>> '{totals,gross}')::numeric,
    platform_fee_total = (p_plan #>> '{totals,platform_fee_total}')::numeric,
    referral_fee_total = (p_plan #>> '{totals,referral_total}')::numeric,
    broker_net = (p_plan #>> '{totals,broker_net}')::numeric,
    plan_snapshot = p_plan -> 'snapshot',
    commission_amount_thb = case when p_plan #>> '{totals,currency}' = 'THB' then (p_plan #>> '{totals,gross}')::numeric else commission_amount_thb end,
    updated_at = now()
  where id = p_deal;

  r := public.deal_rank(d.status);
  for e in select * from jsonb_array_elements(coalesce(p_plan -> 'entries', '[]'::jsonb)) loop
    ts := case e ->> 'milestone'
            when 'reserved' then d.reserved_at when 'contract_signed' then d.contract_signed_at else d.completed_at end;
    insert into public.ledger_entries (deal_id, milestone, kind, payer_org, payee_org, amount, currency, delay_days, status, due_at)
    values (
      p_deal, e ->> 'milestone', e ->> 'kind',
      nullif(e ->> 'payer_org', '')::uuid, nullif(e ->> 'payee_org', '')::uuid,
      (e ->> 'amount')::numeric, e ->> 'currency', coalesce((e ->> 'delay_days')::int, 0),
      case when r >= public.deal_rank(e ->> 'milestone') then 'due' else 'expected' end,
      case when r >= public.deal_rank(e ->> 'milestone')
           then coalesce(ts, now()) + make_interval(days => coalesce((e ->> 'delay_days')::int, 0)) else null end
    );
  end loop;

  insert into public.deal_events (deal_id, event, note, actor) values (p_deal, 'plan_set', coalesce(p_plan #>> '{snapshot,summary}', ''), auth.uid());
end $$;

create or replace function public.advance_deal(p_deal uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare d record; nr int; paid boolean;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.id is null then raise exception 'deal not found'; end if;
  if d.status in ('lost', 'cancelled', 'won') then raise exception 'deal is already closed'; end if;

  if p_status in ('reserved', 'contract_signed', 'won') then
    nr := public.deal_rank(p_status);
    if nr <= public.deal_rank(d.status) then raise exception 'a deal cannot move backwards or repeat a status'; end if;
    if d.commission_gross is null then raise exception 'plan the commission before moving the deal forward'; end if;
    update public.deals set
      status = p_status,
      reserved_at = case when nr >= 1 then coalesce(reserved_at, now()) else reserved_at end,
      contract_signed_at = case when nr >= 2 then coalesce(contract_signed_at, now()) else contract_signed_at end,
      completed_at = case when nr >= 3 then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
    where id = p_deal;
    update public.ledger_entries set status = 'due', due_at = now() + make_interval(days => delay_days)
     where deal_id = p_deal and status = 'expected' and milestone is not null and public.deal_rank(milestone) <= nr;
  elsif p_status in ('lost', 'cancelled') then
    select exists (select 1 from public.ledger_entries where deal_id = p_deal and paid_amount > 0) into paid;
    -- only planned entries are voided; manual adjustments / clawbacks must survive the cancellation
    update public.ledger_entries set status = 'void'
     where deal_id = p_deal and status in ('expected', 'due') and paid_amount = 0 and kind not in ('adjustment', 'clawback');
    update public.deals set status = p_status, lost_reason = left(coalesce(p_note, ''), 1000), clawback_review = paid, updated_at = now() where id = p_deal;
  else
    raise exception 'unknown status';
  end if;

  insert into public.deal_events (deal_id, event, from_status, to_status, note, actor)
  values (p_deal, 'status', d.status, p_status, left(coalesce(p_note, ''), 1000), auth.uid());
end $$;

create or replace function public.record_ledger_payment(p_entry uuid, p_amount numeric, p_ref text, p_paid_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare e record; total numeric;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.ledger_entries where id = p_entry for update;
  if e.id is null then raise exception 'entry not found'; end if;
  if e.status <> 'due' then raise exception 'only due entries can be paid (status: %)', e.status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  total := e.paid_amount + p_amount;
  if total > e.amount then raise exception 'payment exceeds the amount due'; end if;
  insert into public.ledger_payments (entry_id, amount, reference, paid_at, recorded_by) values (p_entry, p_amount, coalesce(p_ref, ''), coalesce(p_paid_at, now()), auth.uid());
  update public.ledger_entries set paid_amount = total, status = case when total = amount then 'paid' else status end,
         paid_at = case when total = amount then coalesce(p_paid_at, now()) else paid_at end
   where id = p_entry;
  insert into public.deal_events (deal_id, event, note, actor)
  values (e.deal_id, 'payment', format('%s %s %s', p_amount, e.currency, coalesce(p_ref, '')), auth.uid());
end $$;

-- Manual adjustment / clawback (never edits existing entries)
create or replace function public.add_ledger_adjustment(p_deal uuid, p_kind text, p_payer uuid, p_payee uuid, p_amount numeric, p_currency text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('adjustment', 'clawback') then raise exception 'bad kind'; end if;
  if length(coalesce(p_note, '')) < 5 then raise exception 'a note is required'; end if;
  insert into public.ledger_entries (deal_id, kind, payer_org, payee_org, amount, currency, status, due_at, note)
  values (p_deal, p_kind, p_payer, p_payee, p_amount, p_currency, 'due', now(), p_note);
  insert into public.deal_events (deal_id, event, note, actor) values (p_deal, p_kind, p_note, auth.uid());
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'set_deal_plan(uuid, jsonb)', 'advance_deal(uuid, text, text)',
    'record_ledger_payment(uuid, numeric, text, timestamptz)',
    'add_ledger_adjustment(uuid, text, uuid, uuid, numeric, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS and party-scoped views
-- ---------------------------------------------------------------------------
alter table public.commission_agreements enable row level security;
alter table public.broker_terms enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_payments enable row level security;
alter table public.deal_events enable row level security;

create policy "agreements_staff" on public.commission_agreements for all using (public.is_staff()) with check (public.is_staff());
create policy "agreements_parties_read" on public.commission_agreements for select using (
  status = 'active' and (
    public.partner_of_org(developer_org_id)
    or (broker_org_id is not null and public.partner_of_org(broker_org_id))
    or (visibility = 'public_to_brokers' and exists (
          select 1 from public.profiles pr join public.orgs o on o.id = pr.org_id
          where pr.id = auth.uid() and pr.role = 'partner' and o.kind = 'broker'))
  )
);

create policy "broker_terms_staff" on public.broker_terms for all using (public.is_staff()) with check (public.is_staff());
create policy "broker_terms_own_read" on public.broker_terms for select using (public.partner_of_org(broker_org_id));

create policy "ledger_staff" on public.ledger_entries for all using (public.is_staff()) with check (public.is_staff());
create policy "ledger_parties_read" on public.ledger_entries for select using (
  (payer_org is not null and public.partner_of_org(payer_org)) or (payee_org is not null and public.partner_of_org(payee_org))
);
create policy "ledger_payments_staff" on public.ledger_payments for select using (public.is_staff());
create policy "deal_events_staff" on public.deal_events for select using (public.is_staff());

-- A developer sees what it pays; a broker sees its own share. Neither sees the other side's terms.
create or replace view public.developer_deals_v as
select d.id, d.project_id, d.status, d.contract_price, d.price_currency,
       d.commission_gross, d.commission_currency, d.created_at, d.reserved_at, d.contract_signed_at, d.completed_at
from public.deals d
where d.developer_org_id is not null and public.partner_of_org(d.developer_org_id);

create or replace view public.broker_deals_v as
select d.id, d.project_id, d.status, d.contract_price, d.price_currency,
       d.commission_gross, d.platform_fee_total, d.referral_fee_total, d.broker_net, d.commission_currency,
       d.created_at, d.reserved_at, d.contract_signed_at, d.completed_at
from public.deals d
where d.broker_org_id is not null and public.partner_of_org(d.broker_org_id);

grant select on public.developer_deals_v, public.broker_deals_v to authenticated;
grant select on public.commission_agreements, public.broker_terms, public.ledger_entries to authenticated;

-- Compatibility must run AFTER model v2. The recorded 20250414000003 was a no-op on production.
alter policy translations_public_read on public.catalog_project_translations
  using (review_status='reviewed' and public.is_public_project(project_id));
alter policy project_units_partner_read on public.project_units to authenticated;
alter policy unit_history_partner on public.unit_price_history to authenticated;

create or replace view public.public_catalog_projects with (security_barrier = true) as
select cp.id, cp.legacy_id, cp.slug,
  (cp.payload || jsonb_build_object('rec', 'WATCH', 'recText', '')) as payload,
  cp.lat, cp.lng, cp.data_confirmed_at, cp.updated_at,
  cp.verification_level, cp.verified_at, cp.verification_expires_at,
  cp.jurisdiction_code, cp.region_id, cp.developer_id
from public.catalog_projects cp
where cp.is_published and cp.moderation_status = 'published';
revoke all on public.public_catalog_projects from public;
grant select on public.public_catalog_projects to anon, authenticated, service_role;

-- Read-only party views deliberately filter through partner_of_org; revoke anon explicitly.
revoke all on public.developer_deals_v, public.broker_deals_v, public.org_active_units from anon;
revoke execute on function public.project_units_track() from public, anon, authenticated;
revoke execute on function public.project_units_touch() from public, anon, authenticated;
revoke execute on function public.verification_cases_immutable() from public, anon, authenticated;
revoke execute on function public.ledger_entries_guard() from public, anon, authenticated;
alter function public.ledger_entries_guard() set search_path = pg_catalog;
alter function public.verification_cases_immutable() set search_path = pg_catalog;
alter function public.deal_rank(text) set search_path = pg_catalog;
