-- Consent evidence + routing/index improvements for leads
alter table public.leads add column if not exists consent_at timestamptz;
alter table public.leads add column if not exists consent_version text;
create index if not exists leads_project_uuid_idx on public.leads (project_uuid);
create index if not exists leads_email_created_idx on public.leads (lower(email), created_at desc);
