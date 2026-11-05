-- Keep reviewed translations as recoverable editorial work, but never let an old
-- translation mask a newly saved source. Runs atomically for every payload write
-- (studio, JSON import, moderation), not only one application save path.
alter table public.catalog_project_translations
  drop constraint if exists catalog_project_translations_review_status_check;
alter table public.catalog_project_translations
  add constraint catalog_project_translations_review_status_check
  check (review_status in ('machine', 'reviewed', 'outdated'));

create or replace function public.invalidate_changed_project_translations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.payload -> 'desc' is distinct from new.payload -> 'desc'
     or old.payload -> 'stT' is distinct from new.payload -> 'stT'
     or old.payload -> 'stK' is distinct from new.payload -> 'stK'
     or old.payload -> 'compQ' is distinct from new.payload -> 'compQ'
     or old.payload -> 'compY' is distinct from new.payload -> 'compY'
     or old.payload -> 'tags' is distinct from new.payload -> 'tags' then
    update public.catalog_project_translations
       set review_status = 'outdated', updated_at = now()
     where project_id = new.id and review_status = 'reviewed';
  end if;
  return new;
end;
$$;

revoke all on function public.invalidate_changed_project_translations()
  from public, anon, authenticated;

drop trigger if exists catalog_projects_invalidate_translations on public.catalog_projects;
create trigger catalog_projects_invalidate_translations
  after update of payload on public.catalog_projects
  for each row execute function public.invalidate_changed_project_translations();

comment on function public.invalidate_changed_project_translations() is
  'Preserves translated text and historical review provenance, marks reviewed rows outdated after source edits. Public readers only accept reviewed translations. No historical staleness is inferred or backfilled.';
