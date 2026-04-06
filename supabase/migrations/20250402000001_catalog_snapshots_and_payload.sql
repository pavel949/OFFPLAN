-- Versioned catalogue snapshots + optional full JSON document on projects
-- (mirrors `CatalogProject` / `data/seed/projects.json` shape in app code)

-- Full quarterly exports for audit / rollback (optional use from admin pipeline)
create table public.catalog_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  quarter_label text,
  projects jsonb not null,
  created_at timestamptz not null default now()
);

create index catalog_snapshots_created_idx on public.catalog_snapshots (created_at desc);

alter table public.projects
  add column if not exists payload jsonb;

comment on column public.projects.payload is
  'Full catalogue row JSON (same keys as lib/schema catalogProjectSchema). Denormalized scalar columns on projects remain for simple SQL filters; treat payload as canonical when present.';

alter table public.catalog_snapshots enable row level security;

create policy "catalog_snapshots_read_anon" on public.catalog_snapshots
  for select using (true);

create policy "catalog_snapshots_write_editor" on public.catalog_snapshots
  for insert with check (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('editor', 'admin')
  );
