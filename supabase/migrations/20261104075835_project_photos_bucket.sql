-- Public bucket for developer-uploaded project photos.
-- Anyone can view (public bucket); only the project's own organisation (or staff, via
-- can_submit_project_evidence) can upload, and only under "<project_id>/...". No update/delete policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-photos', 'project-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project_photos_owner_insert" on storage.objects;
create policy "project_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_submit_project_evidence(((storage.foldername(name))[1])::uuid)
  );
