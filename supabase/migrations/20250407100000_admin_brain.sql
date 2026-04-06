-- Admin "brain": methodology settings, project documents, WhatsApp text imports

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('memo', 'marketing', 'legal', 'plan', 'other')),
  title text not null default '',
  storage_path text not null,
  mime text not null default 'application/octet-stream',
  file_size int not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_idx on public.project_documents (project_id);

create table if not exists public.whatsapp_ingests (
  id uuid primary key default gen_random_uuid(),
  source_label text not null default 'paste',
  raw_text text not null,
  parsed jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
alter table public.project_documents enable row level security;
alter table public.whatsapp_ingests enable row level security;

drop policy if exists "platform_settings_staff" on public.platform_settings;
create policy "platform_settings_staff" on public.platform_settings
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

drop policy if exists "project_documents_staff" on public.project_documents;
create policy "project_documents_staff" on public.project_documents
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

drop policy if exists "whatsapp_ingests_staff" on public.whatsapp_ingests;
create policy "whatsapp_ingests_staff" on public.whatsapp_ingests
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'editor')
    )
  );

insert into public.platform_settings (key, value)
values (
  'rating_methodology',
  jsonb_build_object(
    'ru', 'Опишите шкалу rat (0–10), risk (1–3), rec (BUY/WATCH/AVOID) и источники данных.',
    'en', 'Describe rat, risk, rec methodology and data sources.',
    'weights', jsonb_build_object(
      'rat', '0–10 composite (liquidity, developer, zone, product)',
      'risk', '1–3 (low to high)',
      'rec', 'Editorial label after methodology'
    )
  )
)
on conflict (key) do nothing;

insert into public.platform_settings (key, value)
values (
  'catalog_headline',
  jsonb_build_object('totalValueBnTHB', 71, 'quarterLabel', 'Q2 2026')
)
on conflict (key) do nothing;

-- Private bucket for PDFs, sheets, marketing files (server uploads via service role)
insert into storage.buckets (id, name, public)
values ('project-docs', 'project-docs', false)
on conflict (id) do nothing;
