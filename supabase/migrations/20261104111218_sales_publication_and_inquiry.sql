alter table public.project_units drop constraint project_units_status_check;
alter table public.project_units add constraint project_units_status_check check(status in ('unknown','available','reserved','sold'));
alter table public.project_units alter column status set default 'unknown';

create table public.project_sales_publications (
 project_id uuid primary key references public.catalog_projects(id),
 revision integer not null,
 expires_at timestamptz not null,
 published_at timestamptz not null default now(),
 foreign key(project_id,revision) references public.project_sales_models(project_id,revision)
);
alter table public.project_sales_publications enable row level security;
revoke all on public.project_sales_publications from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.project_sales_publications to service_role;
create policy sales_publications_service on public.project_sales_publications for all to service_role using(true) with check(true);

create function public.guard_sales_publication() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.catalog_projects where id=new.project_id for update;
 if new.revision is distinct from (select max(revision) from public.project_sales_models where project_id=new.project_id) then raise exception 'publication revision conflict'; end if;
 if new.expires_at<=now() or new.expires_at>now()+interval '31 days' then raise exception 'publication expiry invalid'; end if;
 if not exists(select 1 from public.catalog_projects where id=new.project_id and is_published and moderation_status='published') then raise exception 'project not public'; end if;
 new.published_at=now();
 return new;
end $$;
revoke all on function public.guard_sales_publication() from public,anon,authenticated;
create trigger guard_sales_publication before insert or update on public.project_sales_publications
for each row execute function public.guard_sales_publication();

alter table public.leads add column sales_selection jsonb;
comment on column public.leads.sales_selection is 'Server-resolved public unit/offer and terms snapshot at inquiry time. Client supplies IDs/revision only. Never an accepted contract or payment receipt.';

create function public.guard_lead_sales_selection() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.sales_selection is distinct from old.sales_selection then raise exception 'sales selection is immutable'; end if;
 elsif new.sales_selection is not null then
   if current_user not in ('service_role','postgres') then raise exception 'sales selection must be resolved by server'; end if;
   perform 1 from public.project_sales_publications where project_id=new.project_uuid for share;
   if not exists (
     select 1 from public.project_sales_publications p join public.catalog_projects c on c.id=p.project_id
     join public.project_units u on u.project_id=c.id and u.id=(new.sales_selection->>'unitId')::uuid
     join public.project_sales_models m on m.project_id=p.project_id and m.revision=p.revision
     cross join lateral jsonb_array_elements(m.model->'offers') o
     where p.project_id=new.project_uuid and p.revision=(new.sales_selection->>'revision')::integer
       and p.expires_at>now() and c.is_published and c.moderation_status='published'
       and u.status not in ('reserved','sold')
       and o->>'id'=new.sales_selection->>'id' and o->>'unitId'=u.id::text and o->>'status'='offered'
       and (o->>'price')::numeric=(new.sales_selection->>'price')::numeric and o->>'currency'=new.sales_selection->>'currency'
   ) then raise exception 'selected offer is no longer published'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_lead_sales_selection() from public,anon,authenticated;
create trigger guard_lead_sales_selection before insert or update on public.leads
for each row execute function public.guard_lead_sales_selection();
