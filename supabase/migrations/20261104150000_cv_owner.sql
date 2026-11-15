-- Platform owner for the ClearView methodology.
-- The owner (identified by a verified e-mail) may edit methodology versions and publish them without a second approver.
-- Publication is never silent: every version records HOW it was approved (`approval_mode`), and that is public.

create table if not exists public.platform_owners (
  email text primary key check (email = lower(btrim(email))),
  created_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;
revoke all on public.platform_owners from anon, authenticated;

insert into public.platform_owners (email) values ('pavel@ignatevestate.com') on conflict do nothing;

-- Owner sole approval can be switched off later (e.g. once two independent analysts are onboarded). Public on purpose.
insert into public.platform_settings (key, value) values ('cv_owner_sole_approval', 'true'::jsonb) on conflict (key) do nothing;

alter table public.cv_methodology_versions
  add column if not exists approval_mode text not null default 'dual' check (approval_mode in ('dual', 'owner'));
grant select (approval_mode) on public.cv_methodology_versions to anon, authenticated;

-- Who is the owner: the e-mail in the caller's verified JWT must be in `platform_owners`.
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_owners o
     where o.email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
  );
$$;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_platform_owner() to authenticated, service_role;

create or replace function public.cv_owner_sole_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text = 'true' from public.platform_settings where key = 'cv_owner_sole_approval'), false);
$$;
revoke all on function public.cv_owner_sole_enabled() from public, anon, authenticated;

-- A published version stays immutable, including how it was approved.
create or replace function public.cv_versions_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'cv_methodology_versions: only drafts can be deleted'; end if;
    return old;
  end if;
  if old.status in ('published', 'retired') then
    if old.status = 'published' and new.status = 'retired'
       and new.config = old.config and new.config_hash = old.config_hash and new.version = old.version
       and new.approval_mode = old.approval_mode then
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

-- Publish a version (internal helper, not callable through the API).
create or replace function public.cv_publish_internal(p_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.cv_methodology_versions;
begin
  select * into v from public.cv_methodology_versions where id = p_id for update;
  update public.cv_methodology_versions set status = 'retired'
   where jurisdiction_code = v.jurisdiction_code and status = 'published' and id <> p_id;
  update public.cv_methodology_versions
     set status = 'published', published_at = now(), approval_mode = p_mode,
         config_hash = encode(sha256(convert_to(config::text, 'utf8')), 'hex')
   where id = p_id;
end $$;
revoke all on function public.cv_publish_internal(uuid, text) from public, anon, authenticated;

-- Owner publishes alone. Called by the server with the e-mail of the verified owner session; the database re-checks it.
create or replace function public.cv_owner_publish(p_id uuid, p_email text, p_summary text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.cv_methodology_versions;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role only' using errcode = '42501'; end if;
  if not exists (select 1 from public.platform_owners where email = lower(btrim(coalesce(p_email, '')))) then
    raise exception 'not a platform owner' using errcode = '42501';
  end if;
  if not public.cv_owner_sole_enabled() then raise exception 'owner sole approval is switched off'; end if;
  if length(coalesce(p_summary, '')) < 20 then raise exception 'describe the change (20+ characters)'; end if;
  select * into v from public.cv_methodology_versions where id = p_id for update;
  if v.id is null or v.status not in ('draft', 'review') then raise exception 'only a draft or a version in review can be published'; end if;
  update public.cv_methodology_versions set status = 'review', submitted_at = now(), change_summary = p_summary where id = p_id and status = 'draft';
  update public.cv_methodology_versions set change_summary = p_summary where id = p_id;
  delete from public.cv_methodology_approvals where version_id = p_id;
  perform public.cv_publish_internal(p_id, 'owner');
end $$;
revoke all on function public.cv_owner_publish(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cv_owner_publish(uuid, text, text) to service_role;

-- Reviewer decision: the owner (as reviewer) can publish alone while sole approval is on; everyone else needs two approvals.
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

  if public.is_platform_owner() and public.cv_owner_sole_enabled() then
    perform public.cv_publish_internal(p_id, 'owner');
    return 'published';
  end if;

  select count(*) into n from public.cv_methodology_approvals where version_id = p_id and decision = 'approve';
  if n < 2 then return 'approved_waiting'; end if;
  perform public.cv_publish_internal(p_id, 'dual');
  return 'published';
end $$;
revoke all on function public.cv_review_version(uuid, text, text) from public, anon;
grant execute on function public.cv_review_version(uuid, text, text) to authenticated;
