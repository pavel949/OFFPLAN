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
rollback;
select 'Developer directory atomic update and permissions: OK';
