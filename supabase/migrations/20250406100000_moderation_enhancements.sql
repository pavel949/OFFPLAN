-- Moderation: baseline for diff, partner read own submissions, block edits while pending

alter table public.moderation_submissions
  add column if not exists baseline_snapshot jsonb;

alter table public.correction_requests
  add column if not exists updated_at timestamptz not null default now();

alter table public.correction_requests
  add column if not exists admin_note text not null default '';

-- Partner update: not while project has pending submission; not when row is pending_review
drop policy if exists "catalog_projects_partner_update" on public.catalog_projects;
create policy "catalog_projects_partner_update" on public.catalog_projects
  for update using (
    org_id is not null
    and org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
    and moderation_status in ('draft', 'rejected', 'published')
    and not exists (
      select 1 from public.moderation_submissions ms
      where ms.entity_type = 'project'
        and ms.entity_id = catalog_projects.id
        and ms.status = 'pending'
    )
  );

-- Partner: read own moderation rows
drop policy if exists "moderation_partner_read_own" on public.moderation_submissions;
create policy "moderation_partner_read_own" on public.moderation_submissions
  for select using (
    submitted_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'partner')
  );
