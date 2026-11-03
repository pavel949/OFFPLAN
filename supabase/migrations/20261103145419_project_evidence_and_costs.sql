-- Sourced project facts are append-only for partners and published only by staff.
-- No demonstration values, estimates, inventory, photographs or identities are seeded.
create table public.project_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects(id),
  kind text not null check (kind in ('photo','amenity','operating_cost','sales')),
  fact_key text not null check (length(fact_key) between 1 and 100),
  title text not null check (length(title) between 1 and 300),
  source_url text not null check (source_url ~ '^https://[^[:space:]]+$'),
  observed_at date not null,
  details jsonb not null check (jsonb_typeof(details) = 'object'),
  status text not null default 'pending' check (status in ('pending','published','archived','rejected')),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  check (status <> 'published' or reviewed_at is not null),
  check (kind <> 'photo' or (details ?& array['url','caption'] and details->>'url' ~ '^https://[^[:space:]]+$' and details->>'caption' is not null)),
  check (kind <> 'operating_cost' or (
    details ?& array['amount','currency','basis','period']
    and jsonb_typeof(details->'amount') = 'number' and (details->>'amount')::numeric >= 0
    and details->>'currency' ~ '^[A-Z]{3}$'
    and details->>'basis' in ('unit','sqm') and details->>'period' in ('month','year','once'))),
  check (kind <> 'sales' or (details ? 'stage' and details->>'stage' in ('prelaunch','launch','selling','last_units','sold_out')))
);
create index project_evidence_project_idx on public.project_evidence(project_id, kind, status);
create unique index project_evidence_published_uq on public.project_evidence(project_id,kind,fact_key) where status='published';
alter table public.project_evidence enable row level security;

create function public.can_submit_project_evidence(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select public.is_staff() or exists (
   select 1 from public.catalog_projects cp join public.profiles p on p.org_id=cp.org_id
   where cp.id=p_project and p.id=(select auth.uid()) and p.role='partner'
   and coalesce(p.partner_role,'owner') in ('owner')
 );
$$;
revoke all on function public.can_submit_project_evidence(uuid) from public;
grant execute on function public.can_submit_project_evidence(uuid) to anon,authenticated,service_role;

create policy evidence_public_read on public.project_evidence for select to anon,authenticated
 using (status='published' and public.is_public_project(project_id));
create policy evidence_owner_read on public.project_evidence for select to authenticated
 using (public.can_submit_project_evidence(project_id));
create policy evidence_partner_submit on public.project_evidence for insert to authenticated
 with check (public.can_submit_project_evidence(project_id) and status='pending'
   and submitted_by=(select auth.uid()) and reviewed_by is null and reviewed_at is null);
create policy evidence_staff_update on public.project_evidence for update to authenticated
 using (public.is_staff()) with check (public.is_staff());
grant select on public.project_evidence to anon,authenticated;
grant insert on public.project_evidence to authenticated;
grant update on public.project_evidence to authenticated;
grant all on public.project_evidence to service_role;

create function public.review_project_evidence(p_id uuid,p_approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare e public.project_evidence;
begin
 if not (public.is_staff() or (select auth.role())='service_role') then
   raise exception 'staff only' using errcode='42501';
 end if;
 select * into e from public.project_evidence where id=p_id for update;
 if e.id is null or e.status<>'pending' then raise exception 'pending evidence not found'; end if;
 -- Serialise two staff decisions on the same project/fact without losing either submission.
 perform 1 from public.catalog_projects where id=e.project_id for update;
 if p_approve then
   update public.project_evidence set status='archived'
    where project_id=e.project_id and kind=e.kind and fact_key=e.fact_key and status='published';
 end if;
 update public.project_evidence set status=case when p_approve then 'published' else 'rejected' end,
   reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
end $$;
revoke all on function public.review_project_evidence(uuid,boolean) from public,anon;
grant execute on function public.review_project_evidence(uuid,boolean) to authenticated,service_role;

-- RLS on units restricts counts to published projects; the view exposes no buyer or financial data.
create view public.public_project_inventory with (security_invoker=true) as
 select project_id,count(*)::int as recorded,
 count(*) filter(where status='available')::int as available,
 count(*) filter(where status='reserved')::int as reserved,
 count(*) filter(where status='sold')::int as sold,
 max(price_updated_at) as updated_at
 from public.project_units group by project_id;
grant select on public.public_project_inventory to anon,authenticated,service_role;
comment on view public.public_project_inventory is 'Counts cover recorded inventory only, not total stock. No rows means unknown, not sold out.';

-- Allocate public IDs on approval, never trust a developer-supplied payload.id.
create sequence public.catalog_public_id_seq;
select setval('public.catalog_public_id_seq',greatest(coalesce((select max(legacy_id) from public.catalog_projects),0)+1,1),false);
revoke all on sequence public.catalog_public_id_seq from public,anon,authenticated;
grant usage,select on sequence public.catalog_public_id_seq to service_role;

create or replace function public.moderation_approve(p_submission_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  sub public.moderation_submissions%rowtype;
  n int;
  public_id integer;
begin
  select * into sub from public.moderation_submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found' using errcode = 'P0002'; end if;
  if sub.status <> 'pending' then raise exception 'already_processed' using errcode = 'P0001'; end if;

  if sub.entity_type = 'project' then
    select coalesce(legacy_id,nextval('public.catalog_public_id_seq')::integer) into public_id
      from public.catalog_projects where id=sub.entity_id for update;
    update public.catalog_projects
       set payload = jsonb_set(sub.snapshot,'{id}',to_jsonb(public_id)), legacy_id=public_id, draft_payload = null,
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


-- Keep authentication identifiers out of the public evidence contract.
revoke all on public.project_evidence from anon,authenticated;
grant select(id,project_id,kind,fact_key,title,source_url,observed_at,details,status,reviewed_at)
 on public.project_evidence to anon,authenticated;
grant insert,update on public.project_evidence to authenticated;

-- An organisation's sales staff may manage stock, not create or edit project descriptions.
alter policy catalog_projects_partner_insert on public.catalog_projects to authenticated
 with check (org_id is not null and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner'
  and p.org_id=catalog_projects.org_id and coalesce(p.partner_role,'owner')='owner'));
alter policy catalog_projects_partner_update on public.catalog_projects to authenticated
 using (org_id is not null and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner'
  and p.org_id=catalog_projects.org_id and coalesce(p.partner_role,'owner')='owner')
  and moderation_status in ('draft','rejected','published') and not public.has_pending_submission(id))
 with check (org_id is not null and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='partner'
  and p.org_id=catalog_projects.org_id and coalesce(p.partner_role,'owner')='owner'));
