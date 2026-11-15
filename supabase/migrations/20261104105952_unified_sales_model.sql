-- Admin-only, append-only, versioned aggregate. Existing project_units remain the
-- physical identity; no duplicated stock or automatic public price publication.
create table public.project_sales_models (
  project_id uuid not null references public.catalog_projects(id),
  revision integer not null check(revision > 0),
  model jsonb not null check(jsonb_typeof(model)='object' and coalesce(model->>'version'='1',false)),
  created_at timestamptz not null default now(),
  actor text not null default 'admin_session',
  primary key(project_id,revision),
  check(octet_length(model::text)<=2500000)
);
alter table public.project_sales_models enable row level security;
revoke all on public.project_sales_models from public,anon,authenticated,service_role;
grant select,insert on public.project_sales_models to service_role;
create policy sales_models_read on public.project_sales_models for select to service_role using(true);
create policy sales_models_insert on public.project_sales_models for insert to service_role with check(true);

create function public.guard_project_sales_model() returns trigger
language plpgsql security invoker set search_path='' as $$
declare current_revision integer;
begin
  -- Serialize writes per project; stale browser tabs cannot overwrite each other.
  perform 1 from public.catalog_projects where id=new.project_id for update;
  select coalesce(max(revision),0) into current_revision from public.project_sales_models where project_id=new.project_id;
  if new.revision <> current_revision+1 then raise exception 'revision conflict'; end if;
  if jsonb_typeof(new.model->'units') is distinct from 'array' then raise exception 'units array required'; end if;
  if exists (
    select 1 from jsonb_array_elements(new.model->'units') u
    where not exists(select 1 from public.project_units p where p.id=(u->>'id')::uuid and p.project_id=new.project_id)
  ) then raise exception 'unit project mismatch'; end if;
  new.created_at=now();
  return new;
end $$;
revoke all on function public.guard_project_sales_model() from public,anon,authenticated;
create trigger guard_project_sales_model before insert on public.project_sales_models
for each row execute function public.guard_project_sales_model();
comment on table public.project_sales_models is 'Private versioned sales specification v1. Schema validated by lib/sales-model.ts on server. Not a payment ledger or public offer. JSON unit IDs are checked against project_units on write; historical revisions retain IDs after unit deletion.';
