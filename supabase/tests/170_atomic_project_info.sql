begin;
create function pg_temp.atomic_expect_error(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'Expected atomic save to fail: %',q;
end $$;
insert into public.regions(id,jurisdiction_code,slug,level,name) values
 ('00000000-0000-4000-8000-000000170001','TH','atomic-parent','region','{"en":"Atomic parent","ru":"Родитель"}');
insert into public.developers(id,code,name_en,name_ru) values
 ('00000000-0000-4000-8000-000000170002','ATOMIC_EXISTING','Existing developer','Существующий');
insert into public.catalog_projects(id,slug,payload,draft_payload,is_published,moderation_status,updated_at) values
 ('00000000-0000-4000-8000-000000170003','atomic-project','{"n":"Before"}','{"n":"Private draft"}',false,'draft','2026-11-01');

-- Any downstream write failure must roll back both newly-created references.
create function pg_temp.reject_atomic_project() returns trigger language plpgsql as $$
begin
 if new.id='00000000-0000-4000-8000-000000170003' and new.payload->>'n'='Force failure' then raise exception 'injected project write failure'; end if;
 return new;
end $$;
create trigger test_reject_atomic_project before update on public.catalog_projects for each row execute function pg_temp.reject_atomic_project();
set local role service_role;
select pg_temp.atomic_expect_error($q$select public.admin_save_project_info(
 '00000000-0000-4000-8000-000000170003','2026-11-01','{"n":"Before"}','{"n":"Force failure"}',
 '{"parent_id":"00000000-0000-4000-8000-000000170001","slug":"atomic-failure","name_en":"Failed region","name_ru":"Не сохранено"}',
 '{"name":"Failed developer"}',true)$q$);
-- Regression for the original bug: region insert followed by bad developer.
select pg_temp.atomic_expect_error($q$select public.admin_save_project_info(
 '00000000-0000-4000-8000-000000170003','2026-11-01','{"n":"Before"}','{"n":"Edited"}',
 '{"parent_id":"00000000-0000-4000-8000-000000170001","slug":"atomic-bad-dev","name_en":"Failed region","name_ru":"Не сохранено"}',
 '{"id":"00000000-0000-4000-8000-000000179999"}',false)$q$);
reset role;
do $$ begin
 if exists(select 1 from public.regions where slug in ('atomic-failure','atomic-bad-dev')) then raise exception 'Failed save leaked a region'; end if;
 if exists(select 1 from public.developers where name_en='Failed developer') then raise exception 'Failed save leaked a developer'; end if;
 if (select payload from public.catalog_projects where id='00000000-0000-4000-8000-000000170003')<>'{"n":"Before"}'::jsonb then raise exception 'Failed save mutated project'; end if;
end $$;

-- Success commits exactly one of each reference, canonical fields and audit.
set local role service_role;
select public.admin_save_project_info(
 '00000000-0000-4000-8000-000000170003','2026-11-01','{"n":"Before"}','{"n":"After","desc":"Keep description","dev":"Wrong","dt":"WRONG","zone":"Wrong"}',
 '{"parent_id":"00000000-0000-4000-8000-000000170001","slug":"atomic-success","name_en":"New district","name_ru":"Новый район"}',
 '{"name":"New developer"}',true);
-- A stale concurrent caller must fail before creating references.
select pg_temp.atomic_expect_error($q$select public.admin_save_project_info(
 '00000000-0000-4000-8000-000000170003','2026-11-01','{"n":"Before"}','{"n":"Stale"}',
 '{"parent_id":"00000000-0000-4000-8000-000000170001","slug":"atomic-stale","name_en":"Stale district","name_ru":"Старое"}',
 '{"name":"Stale developer"}',false)$q$);
reset role;
do $$ begin
 if exists(select 1 from public.regions where slug='atomic-stale') or exists(select 1 from public.developers where name_en='Stale developer') then raise exception 'Stale save created references'; end if;
 if (select count(*) from public.regions where slug='atomic-success')<>1 or (select count(*) from public.developers where name_en='New developer')<>1 then raise exception 'Successful references missing or duplicated'; end if;
 if not exists(select 1 from public.catalog_projects p join public.developers d on p.developer_id=d.id join public.regions r on p.region_id=r.id
   where p.id='00000000-0000-4000-8000-000000170003' and p.payload->>'n'='After' and p.payload->>'desc'='Keep description'
   and p.payload->>'dev'=d.name_en and p.payload->>'dt'=d.code and p.payload->>'zone'='New district'
   and p.jurisdiction_code='TH' and p.data_confirmed_at is not null
   and p.draft_payload=('{"n":"Private draft","dev":"New developer"}'::jsonb || jsonb_build_object('dt',d.code))
   and p.org_id is null and not p.is_published and p.moderation_status='draft') then raise exception 'Success corrupted canonical fields, unrelated draft or ownership/publication'; end if;
 if (select count(*) from public.catalog_audit_log where entity_id='00000000-0000-4000-8000-000000170003' and action='project_edited_by_operator')<>1 then raise exception 'Audit is missing or failed operations were audited'; end if;
end $$;

-- Existing directory selections create no references and preserve confirmation.
set local role service_role;
do $$ declare p public.catalog_projects%rowtype; before_regions bigint; before_developers bigint;
begin
 select * into p from public.catalog_projects where id='00000000-0000-4000-8000-000000170003';
 select count(*) into before_regions from public.regions;
 select count(*) into before_developers from public.developers;
 perform public.admin_save_project_info(p.id,p.updated_at,p.payload,p.payload || '{"n":"Existing refs"}',
   '{"id":"00000000-0000-4000-8000-000000170001"}', '{"id":"00000000-0000-4000-8000-000000170002"}',false);
 if (select count(*) from public.regions)<>before_regions or (select count(*) from public.developers)<>before_developers then raise exception 'Existing selections created duplicate references'; end if;
 if not exists(select 1 from public.catalog_projects where id=p.id and payload->>'dev'='Existing developer' and payload->>'dt'='ATOMIC_EXISTING'
   and payload->>'zone'='Atomic parent' and data_confirmed_at is not distinct from p.data_confirmed_at) then raise exception 'Existing reference save lost identity or confirmation'; end if;
end $$;
reset role;

-- Audit failure is also atomic: project and reference writes roll back together.
create function pg_temp.reject_atomic_audit() returns trigger language plpgsql as $$
begin
 if new.entity_id='00000000-0000-4000-8000-000000170003' then raise exception 'injected audit failure'; end if;
 return new;
end $$;
create trigger test_reject_atomic_audit before insert on public.catalog_audit_log for each row execute function pg_temp.reject_atomic_audit();
do $$ declare p public.catalog_projects%rowtype;
begin
 select * into p from public.catalog_projects where id='00000000-0000-4000-8000-000000170003';
 perform pg_temp.atomic_expect_error(format('select public.admin_save_project_info(%L,%L,%L,%L,%L,%L,false)',p.id,p.updated_at,p.payload,'{"n":"Audit failure"}',
   '{"parent_id":"00000000-0000-4000-8000-000000170001","slug":"atomic-audit-failure","name_en":"Audit failure","name_ru":"Ошибка"}', '{"name":"Audit failure developer"}'));
 if exists(select 1 from public.regions where slug='atomic-audit-failure') or exists(select 1 from public.developers where name_en='Audit failure developer') then raise exception 'Audit failure leaked references'; end if;
 if (select payload from public.catalog_projects where id=p.id) is distinct from p.payload then raise exception 'Audit failure did not roll back payload'; end if;
 if has_function_privilege('anon','public.admin_save_project_info(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,boolean)','execute')
   or has_function_privilege('authenticated','public.admin_save_project_info(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,boolean)','execute') then raise exception 'Atomic RPC leaked'; end if;
end $$;
rollback;
select 'Atomic project info: rollback, canonical references, audit and permissions OK';
