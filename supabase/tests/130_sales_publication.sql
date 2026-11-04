begin;
create or replace function pg_temp.sales_expect_error(q text, label text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'FAIL: %',label;
end $$;
do $$ begin
 if has_table_privilege('anon','public.project_sales_publications','select') or has_table_privilege('authenticated','public.project_sales_publications','select') then raise exception 'Publication pointer must be private'; end if;
end $$;
insert into public.catalog_projects(id,slug,payload,is_published,moderation_status) values
 ('00000000-0000-4000-8000-000000130001','test-sales-publication','{}',true,'published');
insert into public.project_units(id,project_id,label) values
 ('00000000-0000-4000-8000-000000130002','00000000-0000-4000-8000-000000130001','E2E-101');
do $$ begin
 if (select status from public.project_units where id='00000000-0000-4000-8000-000000130002')<>'unknown' then raise exception 'New unit availability must be unknown'; end if;
end $$;
insert into public.project_sales_models(project_id,revision,model) values
 ('00000000-0000-4000-8000-000000130001',1,'{"version":1,"units":[{"id":"00000000-0000-4000-8000-000000130002"}],"offers":[{"id":"00000000-0000-4000-8000-000000130003","unitId":"00000000-0000-4000-8000-000000130002","price":1000000,"currency":"THB","status":"offered"}]}');
set local role service_role;
insert into public.project_sales_publications(project_id,revision,expires_at) values
 ('00000000-0000-4000-8000-000000130001',1,now()+interval '1 day');
insert into public.leads(id,name,email,project_uuid,sales_selection) values
 ('00000000-0000-4000-8000-000000130004','E2E transactional test','e2e@example.invalid','00000000-0000-4000-8000-000000130001','{"id":"00000000-0000-4000-8000-000000130003","unitId":"00000000-0000-4000-8000-000000130002","revision":1,"price":1000000,"currency":"THB"}');
reset role;
select pg_temp.sales_expect_error($q$update public.leads set sales_selection='{}' where id='00000000-0000-4000-8000-000000130004'$q$,'snapshot mutated');
select pg_temp.sales_expect_error($q$insert into public.leads(name,email,project_uuid,sales_selection) values ('Fake price','e2e@example.invalid','00000000-0000-4000-8000-000000130001','{"id":"00000000-0000-4000-8000-000000130003","unitId":"00000000-0000-4000-8000-000000130002","revision":1,"price":1,"currency":"THB"}')$q$,'forged price');
delete from public.project_sales_publications where project_id='00000000-0000-4000-8000-000000130001';
select pg_temp.sales_expect_error($q$insert into public.leads(name,email,project_uuid,sales_selection) values ('Withdrawn','e2e@example.invalid','00000000-0000-4000-8000-000000130001','{"id":"00000000-0000-4000-8000-000000130003","unitId":"00000000-0000-4000-8000-000000130002","revision":1,"price":1000000,"currency":"THB"}')$q$,'withdrawn offer accepted');
insert into public.project_sales_models(project_id,revision,model) values
 ('00000000-0000-4000-8000-000000130001',2,'{"version":1,"units":[],"offers":[]}');
select pg_temp.sales_expect_error($q$insert into public.project_sales_publications(project_id,revision,expires_at) values ('00000000-0000-4000-8000-000000130001',1,now()+interval '1 day')$q$,'stale revision published');
do $$ begin
 if (select sales_selection->>'price' from public.leads where id='00000000-0000-4000-8000-000000130004')<>'1000000' then raise exception 'Snapshot lost after withdrawal'; end if;
end $$;
rollback;
select 'Sales publication, inquiry snapshot, withdrawal and tampering: OK';
