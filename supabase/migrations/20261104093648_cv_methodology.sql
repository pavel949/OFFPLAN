-- ClearView methodology versions.
-- The content (weights, risk parameters, modifiers, scale) is private: only the version label, the SHA-256 fingerprint and a
-- change summary are public. A version is authored by the owner, approved by at least TWO independent reviewers and is
-- immutable once published. Assessments pin a version, so nobody can change the rules for one project.

create table if not exists public.cv_methodology_versions (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null references public.jurisdictions (code),
  version text not null check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'retired')),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  config_hash text,
  change_summary text not null default '',
  based_on uuid references public.cv_methodology_versions (id) on delete set null,
  authored_by text not null default 'owner',
  submitted_at timestamptz,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jurisdiction_code, version),
  check (status not in ('published', 'retired') or (config_hash ~ '^[0-9a-f]{64}$' and published_at is not null))
);
create index if not exists cv_versions_based_on_idx on public.cv_methodology_versions (based_on);

create table if not exists public.cv_methodology_approvals (
  version_id uuid not null references public.cv_methodology_versions (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  decision text not null check (decision in ('approve', 'return')),
  note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now(),
  primary key (version_id, reviewer_id)
);
create index if not exists cv_approvals_reviewer_idx on public.cv_methodology_approvals (reviewer_id);

alter table public.cv_methodology_versions enable row level security;
alter table public.cv_methodology_approvals enable row level security;

-- Privileges: everything closed, then open ONLY the public columns (never `config`).
revoke all on public.cv_methodology_versions from anon, authenticated;
revoke all on public.cv_methodology_approvals from anon, authenticated;
grant select (id, jurisdiction_code, version, title, status, config_hash, change_summary, published_at, retired_at)
  on public.cv_methodology_versions to anon, authenticated;
drop policy if exists "cv_versions_public_read" on public.cv_methodology_versions;
create policy "cv_versions_public_read" on public.cv_methodology_versions
  for select to anon, authenticated using (status in ('published', 'retired'));

-- Reviewers see the public columns of versions under review (never `config`: they read it through cv_version_config).
drop policy if exists "cv_versions_reviewer_read" on public.cv_methodology_versions;
create policy "cv_versions_reviewer_read" on public.cv_methodology_versions
  for select to authenticated using (public.is_reviewer());

-- Immutability: published and retired versions never change (except published -> retired).
create or replace function public.cv_versions_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'cv_methodology_versions: only drafts can be deleted'; end if;
    return old;
  end if;
  if old.status in ('published', 'retired') then
    if old.status = 'published' and new.status = 'retired'
       and new.config = old.config and new.config_hash = old.config_hash and new.version = old.version then
      new.retired_at := coalesce(new.retired_at, now());
      return new;
    end if;
    raise exception 'cv_methodology_versions: a published version is immutable';
  end if;
  if new.status = 'published' and old.status <> 'review' then
    raise exception 'cv_methodology_versions: only a version in review can be published';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists cv_versions_guard_trg on public.cv_methodology_versions;
create trigger cv_versions_guard_trg before update or delete on public.cv_methodology_versions
  for each row execute function public.cv_versions_guard();
revoke all on function public.cv_versions_guard() from public, anon, authenticated;

-- Owner (service role) submits a draft for review: clears earlier decisions.
create or replace function public.cv_submit_for_review(p_id uuid, p_summary text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role only' using errcode = '42501'; end if;
  if length(coalesce(p_summary, '')) < 20 then raise exception 'describe the change (20+ characters)'; end if;
  update public.cv_methodology_versions
     set status = 'review', submitted_at = now(), change_summary = p_summary
   where id = p_id and status = 'draft';
  if not found then raise exception 'only a draft can be submitted'; end if;
  delete from public.cv_methodology_approvals where version_id = p_id;
end $$;
revoke all on function public.cv_submit_for_review(uuid, text) from public, anon, authenticated;
grant execute on function public.cv_submit_for_review(uuid, text) to service_role;

-- A reviewer reads the private content of a version that is under review (or already published).
create or replace function public.cv_version_config(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select v.config from public.cv_methodology_versions v
   where v.id = p_id and v.status in ('review', 'published', 'retired')
     and (public.is_reviewer() or (select auth.role()) = 'service_role');
$$;
revoke all on function public.cv_version_config(uuid) from public, anon;
grant execute on function public.cv_version_config(uuid) to authenticated, service_role;

-- Reviewer decision. Two distinct approvals publish; any return sends the draft back to the owner.
create or replace function public.cv_review_version(p_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare v public.cv_methodology_versions; n int;
begin
  if not public.is_reviewer() then raise exception 'reviewers only' using errcode = '42501'; end if;
  if p_decision not in ('approve', 'return') then raise exception 'bad decision'; end if;
  select * into v from public.cv_methodology_versions where id = p_id for update;
  if v.id is null or v.status <> 'review' then raise exception 'version is not under review'; end if;
  if p_decision = 'return' and length(coalesce(p_note, '')) < 10 then raise exception 'explain what must change (10+ characters)'; end if;

  insert into public.cv_methodology_approvals (version_id, reviewer_id, decision, note)
  values (p_id, auth.uid(), p_decision, coalesce(p_note, ''))
  on conflict (version_id, reviewer_id) do update set decision = excluded.decision, note = excluded.note, created_at = now();

  if p_decision = 'return' then
    update public.cv_methodology_versions set status = 'draft' where id = p_id;
    return 'returned';
  end if;

  select count(*) into n from public.cv_methodology_approvals where version_id = p_id and decision = 'approve';
  if n < 2 then return 'approved_waiting'; end if;

  update public.cv_methodology_versions set status = 'retired'
   where jurisdiction_code = v.jurisdiction_code and status = 'published';
  update public.cv_methodology_versions
     set status = 'published', published_at = now(),
         config_hash = encode(sha256(convert_to(config::text, 'utf8')), 'hex')
   where id = p_id;
  return 'published';
end $$;
revoke all on function public.cv_review_version(uuid, text, text) from public, anon;
grant execute on function public.cv_review_version(uuid, text, text) to authenticated;

-- Review progress for a version: how many approvals, any returns, and the caller's own decision.
create or replace function public.cv_approval_status(p_id uuid)
returns table (approvals int, returns int, mine text) language sql stable security definer set search_path = public as $$
  select count(*) filter (where decision = 'approve')::int,
         count(*) filter (where decision = 'return')::int,
         max(decision) filter (where reviewer_id = auth.uid())
    from public.cv_methodology_approvals where version_id = p_id
  having public.is_reviewer();
$$;
revoke all on function public.cv_approval_status(uuid) from public, anon;
grant execute on function public.cv_approval_status(uuid) to authenticated;
