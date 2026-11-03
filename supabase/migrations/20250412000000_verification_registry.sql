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
     or new.lng is distinct from old.lng then
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
