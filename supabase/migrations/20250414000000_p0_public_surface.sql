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
