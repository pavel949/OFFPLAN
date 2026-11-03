-- P0 compatibility for features that live on other branches (i18n translations, verification registry).
-- No-op until those tables/columns exist, so it is safe to ship before they merge and to run after.
--
-- After P0 the base table catalog_projects has no public RLS policy, so any policy that sub-selects it
-- under the caller's rights silently returns nothing for anonymous visitors. Fix them with the
-- SECURITY DEFINER helper, and expose the verification columns through the public view.
do $$
begin
  if to_regclass('public.catalog_project_translations') is not null then
    drop policy if exists "translations_public_read" on public.catalog_project_translations;
    create policy "translations_public_read" on public.catalog_project_translations
      for select using (public.is_public_project(project_id));
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'catalog_projects' and column_name = 'verification_level'
  ) then
    -- columns are appended, so CREATE OR REPLACE VIEW is allowed
    create or replace view public.public_catalog_projects as
      select
        cp.id,
        cp.legacy_id,
        cp.slug,
        (cp.payload || jsonb_build_object('rec', 'WATCH', 'recText', '')) as payload,
        cp.lat,
        cp.lng,
        cp.data_confirmed_at,
        cp.updated_at,
        cp.verification_level,
        cp.verified_at,
        cp.verification_expires_at
      from public.catalog_projects cp
      where cp.is_published and cp.moderation_status = 'published';
    grant select on public.public_catalog_projects to anon, authenticated, service_role;
  end if;
end $$;
