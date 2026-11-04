-- Project sources ("data room" links): brochure, renders, price list, availability feed, master plan,
-- Telegram channel, shared drive folder. Developers hand these to agents as LINKS, so we store links
-- (not copies of their files). Each source carries a visibility level, an expected update cadence and
-- a "confirmed current" stamp, so stale feeds are visible.

create table if not exists public.project_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects (id) on delete cascade,
  kind text not null check (kind in (
    'brochure', 'renders', 'price_list', 'availability', 'masterplan', 'floorplans',
    'legal_docs', 'data_room', 'telegram', 'video', 'other'
  )),
  title text not null check (char_length(title) between 1 and 200),
  url text not null check (url ~* '^https://[^[:space:]]+$' and char_length(url) <= 2000),
  visibility text not null default 'partners' check (visibility in ('public', 'partners', 'internal')),
  cadence text not null default 'none' check (cadence in ('none', 'on_change', 'daily', 'weekly', 'monthly')),
  note text not null default '' check (char_length(note) <= 1000),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_sources_project_idx on public.project_sources (project_id);
create index if not exists project_sources_created_by_idx on public.project_sources (created_by);
create index if not exists project_sources_confirmed_by_idx on public.project_sources (confirmed_by);

alter table public.project_sources enable row level security;

-- staff: everything
create policy project_sources_staff on public.project_sources
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- developer organisation members: manage the sources of their own projects
create policy project_sources_org_select on public.project_sources
  for select to authenticated
  using (exists (
    select 1 from public.catalog_projects cp
    join public.profiles pr on pr.org_id = cp.org_id
    where cp.id = project_sources.project_id and pr.id = (select auth.uid()) and pr.role = 'partner'
  ));

create policy project_sources_org_write on public.project_sources
  for all to authenticated
  using (exists (
    select 1 from public.catalog_projects cp
    join public.profiles pr on pr.org_id = cp.org_id
    where cp.id = project_sources.project_id and pr.id = (select auth.uid()) and pr.role = 'partner'
      and coalesce(pr.partner_role, 'owner') <> 'sales'
  ))
  with check (exists (
    select 1 from public.catalog_projects cp
    join public.profiles pr on pr.org_id = cp.org_id
    where cp.id = project_sources.project_id and pr.id = (select auth.uid()) and pr.role = 'partner'
      and coalesce(pr.partner_role, 'owner') <> 'sales'
  ));

-- Anonymous visitors see only links explicitly marked public, and only for published projects.
-- Owner-rights view with a fixed column list; no write privileges are granted on it.
create or replace view public.public_project_sources as
select ps.id, ps.project_id, ps.kind, ps.title, ps.url, ps.cadence, ps.confirmed_at
from public.project_sources ps
join public.catalog_projects cp on cp.id = ps.project_id
where ps.visibility = 'public' and cp.is_published and cp.moderation_status = 'published';

revoke all on public.public_project_sources from public, anon, authenticated;
grant select on public.public_project_sources to anon, authenticated;

-- private table: no anonymous access at all
revoke all on public.project_sources from public, anon;
revoke truncate, references, trigger on public.project_sources from authenticated;

-- partners may change only the content of a link, never its project
create or replace function public.project_sources_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'project_sources: project cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;

create trigger project_sources_guard before insert or update on public.project_sources
  for each row execute function public.project_sources_guard();

revoke execute on function public.project_sources_guard() from public, anon;
