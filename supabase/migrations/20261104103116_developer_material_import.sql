-- Preserve source records without turning historical offers into current stock.
create table public.developer_import_projects (
  external_id text primary key check (external_id ~ '^IE-[0-9]{3}$'),
  developer_code text not null check(developer_code in ('DEV-BANYAN','DEV-SANSIRI','DEV-ASSETWISE')),
  name text not null,
  catalog_project_id uuid references public.catalog_projects(id),
  source_url text not null check(source_url ~ '^https://'),
  source_data jsonb not null check(jsonb_typeof(source_data)='object'),
  counts jsonb not null default '{}',
  mapping_note text not null default '',
  imported_at timestamptz not null default now()
);
create index developer_import_projects_catalog_idx on public.developer_import_projects(catalog_project_id);
create table public.developer_import_records (
  dataset text not null,
  source_row integer not null check(source_row > 1),
  external_project_id text references public.developer_import_projects(external_id),
  source_key text not null,
  data jsonb not null check(jsonb_typeof(data)='object'),
  imported_at timestamptz not null default now(),
  primary key(dataset,source_row)
);
create index developer_import_records_project_idx on public.developer_import_records(external_project_id,dataset,source_row);
alter table public.developer_import_projects enable row level security;
alter table public.developer_import_records enable row level security;
revoke all on public.developer_import_projects,public.developer_import_records from public,anon,authenticated;
grant select,insert,update,delete on public.developer_import_projects,public.developer_import_records to service_role;
create policy imports_projects_service on public.developer_import_projects for all to service_role using(true) with check(true);
create policy imports_records_service on public.developer_import_records for all to service_role using(true) with check(true);
comment on table public.developer_import_records is 'Private dated source records. Not current availability, not approved public media. Preserve multiple offers per physical unit and original quality flags.';
