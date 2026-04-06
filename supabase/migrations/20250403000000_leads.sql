-- Lead inquiries from the public site (optional migration when moving off file storage)
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null default '',
  message text not null default '',
  project_id int,
  project_name text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'lost')),
  source text not null default 'website',
  notes text not null default '',
  locale text not null default 'en' check (locale in ('en', 'ru'))
);

create index leads_created_idx on public.leads (created_at desc);
create index leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

-- Public insert (anon) — only if you expose anon key client-side; otherwise use service role from API
create policy "leads_insert_anon" on public.leads
  for insert to anon
  with check (true);

create policy "leads_read_editor" on public.leads
  for select using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('editor', 'admin')
  );

create policy "leads_update_editor" on public.leads
  for update using (
    auth.role() = 'authenticated'
    and coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('editor', 'admin')
  );
