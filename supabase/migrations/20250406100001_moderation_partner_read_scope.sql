-- Partners in same org can see moderation rows for their projects / org profile
drop policy if exists "moderation_partner_read_own" on public.moderation_submissions;

create policy "moderation_partner_read_scope" on public.moderation_submissions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'partner'
        and p.org_id is not null
        and (
          (
            entity_type = 'project'
            and exists (
              select 1 from public.catalog_projects cp
              where cp.id = entity_id
                and cp.org_id = p.org_id
            )
          )
          or (
            entity_type = 'org'
            and entity_id = p.org_id
          )
        )
    )
  );
