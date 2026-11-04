-- Folder sync (Google Drive): IE staff switch it on per source after the developer has shared the folder
-- with the platform's service account. Developers cannot enable it themselves, so one developer cannot
-- point sync at another developer's folder.
alter table public.project_sources
  add column if not exists sync_enabled boolean not null default false,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_note text not null default '' check (char_length(last_sync_note) <= 500);

create or replace function public.project_sources_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception 'project_sources: project cannot be changed' using errcode = '42501';
  end if;
  if auth.uid() is not null and not public.is_staff() then
    if tg_op = 'INSERT' then
      new.sync_enabled := false;
      new.last_synced_at := null;
      new.last_sync_note := '';
    elsif new.sync_enabled is distinct from old.sync_enabled
       or new.last_synced_at is distinct from old.last_synced_at
       or new.last_sync_note is distinct from old.last_sync_note
       or (new.url is distinct from old.url and old.sync_enabled) then
      raise exception 'project_sources: sync settings are managed by IE' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
