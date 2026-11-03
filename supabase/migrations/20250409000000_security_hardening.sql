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
