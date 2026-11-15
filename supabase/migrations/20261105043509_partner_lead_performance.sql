-- No new direct write grants on leads or access to raw analytics/PII.
alter table public.leads add column responsible_id uuid references public.profiles(id) on delete set null;
alter table public.leads add column responsible_name text;
alter table public.leads add column first_response_at timestamptz;

create function public.partner_update_lead(p_lead_id uuid, p_action text, p_status text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare actor public.profiles; target public.leads;
begin
 select * into actor from public.profiles where id=auth.uid() and role='partner' and org_id is not null;
 if actor.id is null then raise exception 'Partner access required'; end if;
 select l.* into target from public.leads l join public.catalog_projects p on p.id=l.project_uuid
 where l.id=p_lead_id and p.org_id=actor.org_id for update of l;
 if target.id is null then raise exception 'Lead unavailable'; end if;
 if p_action='claim' then
   if target.responsible_id is not null and target.responsible_id<>actor.id then raise exception 'Already assigned'; end if;
   update public.leads set responsible_id=actor.id, responsible_name=coalesce(nullif(actor.full_name,''),'Участник компании'), updated_at=now() where id=target.id;
 elsif p_action in ('status','responded') then
   if target.responsible_id is distinct from actor.id then raise exception 'Take responsibility first'; end if;
   if p_action='status' then
     if p_status is null or p_status not in ('new','contacted','qualified','closed','lost') then raise exception 'Invalid status'; end if;
     update public.leads set status=p_status, updated_at=now() where id=target.id;
   else
     -- Explicit operator attestation, never inferred from notification or status change.
     update public.leads set first_response_at=coalesce(first_response_at,clock_timestamp()), updated_at=now() where id=target.id;
   end if;
 elsif p_action='release' then
   if target.responsible_id is distinct from actor.id and actor.partner_role is distinct from 'owner' then raise exception 'Not responsible'; end if;
   update public.leads set responsible_id=null,responsible_name=null,updated_at=now() where id=target.id;
 else raise exception 'Invalid action';
 end if;
end $$;
revoke all on function public.partner_update_lead(uuid,text,text) from public, anon;
grant execute on function public.partner_update_lead(uuid,text,text) to authenticated;

create function public.partner_showcase_metrics()
returns table(project_id uuid, project_name text, views bigint, interests bigint, leads bigint, responded bigint, median_response_minutes double precision)
language sql stable security definer set search_path = public, pg_temp as $$
 with owned as (
 select p.id,coalesce(nullif(p.payload->>'n',''),p.slug) as name from public.catalog_projects p
 join public.profiles pr on pr.org_id=p.org_id where pr.id=auth.uid() and pr.role='partner'
 ), events as (
 select e.project_id,count(*) filter(where e.name='project.view') as views,
 count(*) filter(where e.name='project.cta_click') as interests
 from public.analytics_events e join owned o on o.id=e.project_id
 where e.created_at>=now()-interval '30 days' and e.created_at<=now() group by e.project_id
 ), inquiries as (
 select l.project_uuid,count(*) as leads,count(*) filter(where l.first_response_at is not null) as responded,
 percentile_cont(0.5) within group(order by extract(epoch from(l.first_response_at-l.created_at))/60.0)
 filter(where l.first_response_at>=l.created_at) as response_minutes
 from public.leads l join owned o on o.id=l.project_uuid
 where l.created_at>=now()-interval '30 days' and l.created_at<=now() group by l.project_uuid
 ) select o.id,o.name,coalesce(e.views,0),coalesce(e.interests,0),coalesce(i.leads,0),coalesce(i.responded,0),i.response_minutes
 from owned o left join events e on e.project_id=o.id left join inquiries i on i.project_uuid=o.id order by o.name;
$$;
revoke all on function public.partner_showcase_metrics() from public, anon;
grant execute on function public.partner_showcase_metrics() to authenticated;
