begin;
create function pg_temp.directory_expect_error(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'Expected directory operation to fail: %',q;
end $$;
insert into public.orgs(id,slug,name_en,name_ru) values ('00000000-0000-4000-8000-000000160001','directory-org','Directory org','Directory org');
insert into public.developers(id,code,name_en,name_ru) values
 ('00000000-0000-4000-8000-000000160002','DIRECTORY_TEST','Before','До'),
 ('00000000-0000-4000-8000-000000160003','DIRECTORY_OTHER','Other','Другой');
insert into public.catalog_projects(id,slug,developer_id,payload,draft_payload,is_published,moderation_status) values
 ('00000000-0000-4000-8000-000000160004','directory-linked','00000000-0000-4000-8000-000000160002','{"n":"Linked","dev":"Before"}','{"n":"Draft edit","dev":"Before"}',false,'draft'),
 ('00000000-0000-4000-8000-000000160005','directory-unlinked','00000000-0000-4000-8000-000000160003','{"n":"Other","dev":"Other"}',null,false,'draft');
insert into public.moderation_submissions(id,entity_type,entity_id,snapshot,status) values
 ('00000000-0000-4000-8000-000000160006','project','00000000-0000-4000-8000-000000160004','{"n":"Reviewed project","dev":"Before","dt":"OLD_CODE","desc":"Submitted text"}','pending');
set local role service_role;
select public.admin_save_developer_directory('00000000-0000-4000-8000-000000160002',1,null,'After','После','https://example.com','00000000-0000-4000-8000-000000160001');
select pg_temp.directory_expect_error($q$select public.admin_save_developer_directory('00000000-0000-4000-8000-000000160002',1,null,'Stale','Устарело',null,null)$q$);
select pg_temp.directory_expect_error($q$select public.admin_save_developer_directory(null,0,'BAD','New','Новый',null,null)$q$);
select public.admin_save_developer_directory(null,0,'DEV123456789ABC','Created','Создан',null,null);
reset role;
do $$ begin
 if (select admin_revision from public.developers where id='00000000-0000-4000-8000-000000160002')<>2 then raise exception 'Revision not advanced'; end if;
 if (select payload->>'dev' from public.catalog_projects where id='00000000-0000-4000-8000-000000160004')<>'After' then raise exception 'Linked public name not synchronized'; end if;
 if (select draft_payload->>'dev' from public.catalog_projects where id='00000000-0000-4000-8000-000000160004')<>'After' then raise exception 'Draft name not synchronized'; end if;
 if (select draft_payload->>'n' from public.catalog_projects where id='00000000-0000-4000-8000-000000160004')<>'Draft edit' then raise exception 'Unrelated draft overwritten'; end if;
 if (select org_id from public.catalog_projects where id='00000000-0000-4000-8000-000000160004') is not null then raise exception 'Ownership changed'; end if;
 if (select is_published from public.catalog_projects where id='00000000-0000-4000-8000-000000160004') then raise exception 'Draft published'; end if;
 if (select payload->>'dev' from public.catalog_projects where id='00000000-0000-4000-8000-000000160005')<>'Other' then raise exception 'Unrelated developer changed'; end if;
 if not exists(select 1 from public.developers where code='DEV123456789ABC') then raise exception 'Create failed'; end if;
 if has_function_privilege('anon','public.admin_save_developer_directory(uuid,integer,text,text,text,text,uuid)','execute') or has_function_privilege('authenticated','public.admin_save_developer_directory(uuid,integer,text,text,text,text,uuid)','execute') then raise exception 'Directory RPC leaked'; end if;
end $$;
-- Older JSON and draft writes cannot restore an obsolete linked identity.
set local role service_role;
update public.catalog_projects set payload='{"n":"JSON edit","dev":"Obsolete","dt":"BAD_CODE"}',
 draft_payload='{"n":"Keep private draft","dev":"Obsolete","dt":"BAD_CODE"}'
 where id='00000000-0000-4000-8000-000000160004';
reset role;
do $$ begin
 if not exists(select 1 from public.catalog_projects where id='00000000-0000-4000-8000-000000160004'
   and payload->>'dev'='After' and payload->>'dt'='DIRECTORY_TEST' and payload->>'n'='JSON edit'
   and draft_payload->>'dev'='After' and draft_payload->>'dt'='DIRECTORY_TEST'
   and draft_payload->>'n'='Keep private draft' and org_id is null and not is_published and moderation_status='draft') then
   raise exception 'JSON normalization changed unrelated facts or failed to preserve identity';
 end if;
end $$;

-- Exercise the actual publication function, not a simulated payload update.
set local role service_role;
select public.moderation_approve('00000000-0000-4000-8000-000000160006');
reset role;
do $$ begin
 if not exists(select 1 from public.catalog_projects where id='00000000-0000-4000-8000-000000160004'
   and payload->>'dev'='After' and payload->>'dt'='DIRECTORY_TEST'
   and payload->>'n'='Reviewed project' and payload->>'desc'='Submitted text'
   and draft_payload is null and org_id is null and is_published and moderation_status='published') then
   raise exception 'Moderation restored stale developer identity or changed unrelated published facts';
 end if;
 if not exists(select 1 from public.moderation_submissions where id='00000000-0000-4000-8000-000000160006'
   and snapshot='{"n":"Reviewed project","dev":"Before","dt":"OLD_CODE","desc":"Submitted text"}'::jsonb and status='approved') then
   raise exception 'Original moderation snapshot was rewritten';
 end if;
 if has_function_privilege('anon','public.canonicalize_linked_project_developer()','execute')
   or has_function_privilege('authenticated','public.canonicalize_linked_project_developer()','execute') then
   raise exception 'Canonical identity trigger leaked';
 end if;
end $$;

-- A new explicit FK supersedes submitted text/code, without creating a draft.
update public.catalog_projects set developer_id='00000000-0000-4000-8000-000000160003'
 where id='00000000-0000-4000-8000-000000160004';
do $$ begin
 if not exists(select 1 from public.catalog_projects where id='00000000-0000-4000-8000-000000160004'
   and payload->>'dev'='Other' and payload->>'dt'='DIRECTORY_OTHER'
   and draft_payload is null and org_id is null and is_published) then
   raise exception 'Explicit developer reassignment not normalized';
 end if;
end $$;

-- Unlinked legacy payloads must retain their independently supplied identity.
insert into public.catalog_projects(id,slug,payload,is_published,moderation_status) values
 ('00000000-0000-4000-8000-000000160007','directory-no-fk','{"dev":"Legacy","dt":"LEGACY"}',false,'draft');
do $$ begin
 if not exists(select 1 from public.catalog_projects where id='00000000-0000-4000-8000-000000160007'
   and payload->>'dev'='Legacy' and payload->>'dt'='LEGACY') then raise exception 'Unlinked identity changed'; end if;
end $$;
rollback;
select 'Developer directory atomic update and permissions: OK';
