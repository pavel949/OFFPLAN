begin;
insert into public.catalog_projects(id,slug,payload,is_published,moderation_status) values
 ('00000000-0000-4000-8000-000000150001','test-translation-source','{"desc":"Old source","stK":"off","stT":"Old status","compQ":"2027","compY":2027,"tags":["old"]}',true,'published'),
 ('00000000-0000-4000-8000-000000150002','test-translation-other','{}',true,'published');
insert into public.catalog_project_translations(project_id,locale,description,status_text,completion_text,tags,review_status,reviewed_at) values
 ('00000000-0000-4000-8000-000000150001','ru','Старое описание','Старый статус','2027',array['старое'],'reviewed','2026-11-01'),
 ('00000000-0000-4000-8000-000000150001','en','Reviewed description','Reviewed status','2027',array['reviewed'],'reviewed','2026-11-01'),
 ('00000000-0000-4000-8000-000000150001','de','Machine description','','',array[]::text[],'machine',null),
 ('00000000-0000-4000-8000-000000150002','ru','Другой проект','','',array[]::text[],'reviewed','2026-11-01');

-- Unrelated edits, no-op saves and private drafts must not discard approval.
update public.catalog_projects set payload=payload where id='00000000-0000-4000-8000-000000150001';
update public.catalog_projects set payload=payload || '{"pN":8}' where id='00000000-0000-4000-8000-000000150001';
update public.catalog_projects set draft_payload='{"desc":"Unpublished draft"}' where id='00000000-0000-4000-8000-000000150001';
do $$ begin
 if (select count(*) from public.catalog_project_translations where review_status='reviewed')<>3 then
   raise exception 'Unrelated edits or private drafts invalidated translations';
 end if;
 if has_function_privilege('anon','public.invalidate_changed_project_translations()','execute')
    or has_function_privilege('authenticated','public.invalidate_changed_project_translations()','execute') then
   raise exception 'Translation invalidation trigger must not be callable by public clients';
 end if;
end $$;

set local role anon;
do $$ begin
 if (select count(*) from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001')<>2 then
   raise exception 'Only reviewed translations should initially be public';
 end if;
end $$;
reset role;

-- Each independently edited source field invalidates every reviewed locale.
-- Values, historical review time, machine drafts and unrelated projects survive.
do $$
declare
 field text;
 value jsonb;
begin
 foreach field in array array['desc','stT','stK','compQ','compY','tags'] loop
   update public.catalog_project_translations set review_status='reviewed'
     where project_id='00000000-0000-4000-8000-000000150001' and locale in ('ru','en');
   value := case when field='compY' then '2030'::jsonb when field='tags' then '["new"]'::jsonb when field='stK' then '"ready"'::jsonb else '"New source"'::jsonb end;
   update public.catalog_projects set payload=jsonb_set(payload,array[field],value)
     where id='00000000-0000-4000-8000-000000150001';
   if (select count(*) from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001' and review_status='outdated')<>2 then
     raise exception 'Source field % did not invalidate translations',field;
   end if;
 end loop;
 if not exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001' and locale='ru' and description='Старое описание' and status_text='Старый статус' and completion_text='2027' and tags=array['старое'] and reviewed_at='2026-11-01'::timestamptz) then
   raise exception 'Original translated text or review provenance was lost';
 end if;
 if not exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001' and locale='de' and review_status='machine' and description='Machine description') then
   raise exception 'Machine translation was changed';
 end if;
 if not exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150002' and review_status='reviewed') then
   raise exception 'Unrelated project was invalidated';
 end if;
end $$;

set local role anon;
do $$ begin
 if exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001') then
   raise exception 'Outdated translation is still publicly readable';
 end if;
end $$;
reset role;

-- Clearing a source also invalidates; failed saves roll both changes back.
update public.catalog_project_translations set review_status='reviewed'
 where project_id='00000000-0000-4000-8000-000000150001' and locale='ru';
do $$ begin
 begin
   update public.catalog_projects set payload=payload - 'desc' where id='00000000-0000-4000-8000-000000150001';
   if not exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001' and locale='ru' and review_status='outdated') then
     raise exception 'Clearing source did not invalidate';
   end if;
   raise exception using errcode='ZX001',message='Simulated save rollback';
 exception when sqlstate 'ZX001' then null;
 end;
 if not exists (select 1 from public.catalog_project_translations where project_id='00000000-0000-4000-8000-000000150001' and locale='ru' and review_status='reviewed') then
   raise exception 'Failed source write did not roll back translation invalidation';
 end if;
end $$;
rollback;
select 'Translation source invalidation, preservation, RLS and rollback: OK';
