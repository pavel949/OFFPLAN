-- Methodology ownership is scoped to a confirmed Supabase Auth account.
create table public.platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email))),
  sole_approval_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.platform_owners enable row level security;
revoke all on public.platform_owners from public, anon, authenticated, service_role;

-- If the owner is invited after this migration, provision this row separately after confirming the account.
insert into public.platform_owners (user_id, email)
select id, lower(email) from auth.users
where lower(email) = 'pavel@ignatevestate.com' and email_confirmed_at is not null;

alter table public.cv_methodology_versions
  add column approval_mode text check (approval_mode in ('dual', 'owner')),
  add column published_by_owner uuid,
  add constraint cv_owner_publication_actor_check check (
    (approval_mode is not distinct from 'owner') = (published_by_owner is not null)
  );
-- Existing publications keep unknown provenance unless it can be established from historical records.
grant select (approval_mode, submitted_at, created_at) on public.cv_methodology_versions to anon, authenticated;
revoke insert, update, truncate on public.cv_methodology_versions from service_role;
grant insert (jurisdiction_code, version, title, config, based_on),
      update (config, title) on public.cv_methodology_versions to service_role;
revoke insert, update, delete, truncate on public.cv_methodology_approvals from service_role;

-- This constraint also protects against writes that skip the publication functions.
create unique index cv_versions_one_published_per_jurisdiction
  on public.cv_methodology_versions (jurisdiction_code) where status = 'published';

create function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.platform_owners o
    join auth.users u on u.id = o.user_id
    where o.user_id = (select auth.uid()) and u.email_confirmed_at is not null and lower(u.email) = o.email
  );
$$;
revoke all on function public.is_platform_owner() from public, anon, authenticated, service_role;
grant execute on function public.is_platform_owner() to authenticated;

-- Permit only a status change and the server-generated retirement timestamp.
create or replace function public.cv_versions_guard()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'new methodology versions must be drafts'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'only methodology drafts can be deleted'; end if;
    return old;
  end if;
  if old.status in ('published', 'retired') then
    if old.status = 'published' and new.status = 'retired'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      new.retired_at := now();
      return new;
    end if;
    raise exception 'a published methodology version is immutable';
  end if;
  if new.status = 'published' and old.status <> 'review' then
    raise exception 'only a methodology version in review can be published';
  end if;
  if old.status = 'review' and (new.config is distinct from old.config or new.title is distinct from old.title) then
    raise exception 'a methodology version in review cannot be edited';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger cv_versions_guard_trg on public.cv_methodology_versions;
create trigger cv_versions_guard_trg before insert or update or delete on public.cv_methodology_versions
  for each row execute function public.cv_versions_guard();
revoke all on function public.cv_versions_guard() from public, anon, authenticated, service_role;

-- Invoked only inside the privileged publication routines, with the candidate row already locked.
create function public.cv_publish_internal(p_id uuid, p_mode text, p_owner_id uuid)
returns void language plpgsql set search_path = pg_catalog as $$
declare country text;
begin
  select jurisdiction_code into strict country from public.cv_methodology_versions where id = p_id;
  perform pg_advisory_xact_lock(hashtextextended('clearview-publish:' || country, 0));
  update public.cv_methodology_versions set status = 'retired'
   where jurisdiction_code = country and status = 'published' and id <> p_id;
  update public.cv_methodology_versions
     set status = 'published', published_at = now(), approval_mode = p_mode, published_by_owner = p_owner_id,
         config_hash = encode(sha256(convert_to(config::text, 'utf8')), 'hex')
   where id = p_id;
end $$;
revoke all on function public.cv_publish_internal(uuid, text, uuid) from public, anon, authenticated, service_role;

-- The server supplies the user ID from Auth getUser(). Check its current binding again in the write transaction.
create function public.cv_owner_publish(p_id uuid, p_owner_id uuid, p_config jsonb, p_summary text)
returns void language plpgsql security definer set search_path = pg_catalog as $$
declare v public.cv_methodology_versions; sole_approval boolean;
begin
  select o.sole_approval_enabled into sole_approval
    from public.platform_owners o join auth.users u on u.id = o.user_id
    where o.user_id = p_owner_id and u.email_confirmed_at is not null and lower(u.email) = o.email
    for share of o, u;
  if not found then raise exception 'not a platform owner' using errcode = '42501'; end if;
  if not sole_approval then raise exception 'owner sole approval is switched off'; end if;
  if length(btrim(coalesce(p_summary, ''))) not between 20 and 4000 then
    raise exception 'describe the change (20–4000 characters)';
  end if;
  select * into v from public.cv_methodology_versions where id = p_id and jurisdiction_code = 'TH' for update;
  if v.id is null or v.status not in ('draft', 'review') then
    raise exception 'only a draft or a version in review can be published';
  end if;
  if jsonb_typeof(p_config) is distinct from 'object'
     or p_config ->> 'version' is distinct from v.version
     or jsonb_typeof(p_config -> 'title') is distinct from 'string' then
    raise exception 'configuration does not match the selected version';
  end if;
  if v.status = 'review' and v.config is distinct from p_config then
    raise exception 'configuration changed since the version was opened';
  end if;
  if v.status = 'draft' then
    update public.cv_methodology_versions set config = p_config, title = left(p_config ->> 'title', 200),
      status = 'review', submitted_at = now() where id = p_id;
  end if;
  update public.cv_methodology_versions set change_summary = btrim(p_summary) where id = p_id;
  perform public.cv_publish_internal(p_id, 'owner', p_owner_id);
end $$;
revoke all on function public.cv_owner_publish(uuid, uuid, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.cv_owner_publish(uuid, uuid, jsonb, text) to service_role;

-- Review decisions take the existing two-analyst path. A platform owner cannot be one of those analysts.
create or replace function public.cv_review_version(p_id uuid, p_decision text, p_note text)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare v public.cv_methodology_versions; n int;
begin
  if not public.is_reviewer() or exists (select 1 from public.platform_owners where user_id = auth.uid()) then
    raise exception 'independent reviewers only' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approve', 'return') then raise exception 'bad decision'; end if;
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

  select count(*) into n
    from public.cv_methodology_approvals a join public.profiles p on p.id = a.reviewer_id and p.role = 'reviewer'
    where a.version_id = p_id and a.decision = 'approve'
      and not exists (select 1 from public.platform_owners o where o.user_id = a.reviewer_id);
  if n < 2 then return 'approved_waiting'; end if;
  perform public.cv_publish_internal(p_id, 'dual', null);
  return 'published';
end $$;
revoke all on function public.cv_review_version(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.cv_review_version(uuid, text, text) to authenticated;

-- Save exactly the validated draft in the same transaction as submission to review.
create function public.cv_submit_for_review(p_id uuid, p_summary text, p_config jsonb)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if jsonb_typeof(p_config) is distinct from 'object'
     or jsonb_typeof(p_config -> 'title') is distinct from 'string' then
    raise exception 'invalid configuration';
  end if;
  update public.cv_methodology_versions
    set config = p_config, title = left(p_config ->> 'title', 200)
    where id = p_id and jurisdiction_code = 'TH' and version = p_config ->> 'version' and status = 'draft';
  if not found then raise exception 'draft no longer exists or does not match the configuration'; end if;
  if length(btrim(coalesce(p_summary, ''))) not between 20 and 4000 then
    raise exception 'describe the change (20–4000 characters)';
  end if;
  perform public.cv_submit_for_review(p_id, btrim(p_summary));
end $$;
revoke all on function public.cv_submit_for_review(uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.cv_submit_for_review(uuid, text, jsonb) to service_role;
