begin;
create function pg_temp.partner_expect_error(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'Expected operation to be denied: %',q;
end $$;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000140001','partner-performance@example.invalid'),
 ('00000000-0000-4000-8000-000000140002','other-performance@example.invalid'),
 ('00000000-0000-4000-8000-000000140008','colleague-performance@example.invalid');
insert into public.orgs(id,slug,name_en,name_ru) values
 ('00000000-0000-4000-8000-000000140003','performance-test','Test','Test');
update public.profiles set role='partner',org_id='00000000-0000-4000-8000-000000140003',partner_role='owner' where id='00000000-0000-4000-8000-000000140001';
update public.profiles set role='partner',org_id='00000000-0000-4000-8000-000000140003',partner_role='sales' where id='00000000-0000-4000-8000-000000140008';
insert into public.catalog_projects(id,slug,org_id,payload) values
 ('00000000-0000-4000-8000-000000140004','performance-owned','00000000-0000-4000-8000-000000140003','{"n":"Owned"}'),
 ('00000000-0000-4000-8000-000000140005','performance-other',null,'{}');
insert into public.leads(id,name,email,project_uuid,created_at) values
 ('00000000-0000-4000-8000-000000140006','test','test@example.invalid','00000000-0000-4000-8000-000000140004',now()-interval '1 hour'),
 ('00000000-0000-4000-8000-000000140007','other','test@example.invalid','00000000-0000-4000-8000-000000140005',now()-interval '1 hour');
insert into public.analytics_events(name,project_id) values
 ('project.view','00000000-0000-4000-8000-000000140004'),
 ('project.cta_click','00000000-0000-4000-8000-000000140004'),
 ('project.view','00000000-0000-4000-8000-000000140005');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000140001',true);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140007','claim')$q$);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','responded')$q$);
select public.partner_update_lead('00000000-0000-4000-8000-000000140006','claim');
select public.partner_update_lead('00000000-0000-4000-8000-000000140006','status','contacted');
do $$ begin
 if (select first_response_at from public.leads where id='00000000-0000-4000-8000-000000140006') is not null then raise exception 'Status must not imply response'; end if;
end $$;
select public.partner_update_lead('00000000-0000-4000-8000-000000140006','responded');
do $$ declare first_at timestamptz; m record; begin
 select first_response_at into first_at from public.leads where id='00000000-0000-4000-8000-000000140006';
 perform public.partner_update_lead('00000000-0000-4000-8000-000000140006','responded');
 if first_at is distinct from (select first_response_at from public.leads where id='00000000-0000-4000-8000-000000140006') then raise exception 'Repeated response changed first timestamp'; end if;
 if (select count(*) from public.partner_showcase_metrics())<>1 then raise exception 'Other projects leaked'; end if;
 select * into m from public.partner_showcase_metrics();
 if m.views<>1 or m.interests<>1 or m.leads<>1 or m.responded<>1 or m.median_response_minutes<60 then raise exception 'Wrong metrics'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000140008',true);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','claim')$q$);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','status','lost')$q$);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','release')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000140002',true);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','claim')$q$);
do $$ begin if exists(select 1 from public.partner_showcase_metrics()) then raise exception 'Buyer read metrics'; end if; end $$;
reset role;
-- Clear the previous test JWT for trusted fixture setup; reset role alone keeps auth.uid().
select set_config('request.jwt.claim.sub','',true);
-- A genuine second partner organization must remain isolated, not only a buyer or unowned project.
insert into public.orgs(id,slug,name_en,name_ru) values
 ('00000000-0000-4000-8000-000000140009','performance-second','Other','Other');
update public.profiles set role='partner',org_id='00000000-0000-4000-8000-000000140009',partner_role='owner' where id='00000000-0000-4000-8000-000000140002';
update public.catalog_projects set org_id='00000000-0000-4000-8000-000000140009' where id='00000000-0000-4000-8000-000000140005';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000140002',true);
select pg_temp.partner_expect_error($q$select public.partner_update_lead('00000000-0000-4000-8000-000000140006','claim')$q$);
select public.partner_update_lead('00000000-0000-4000-8000-000000140007','claim');
do $$ begin
 if (select count(*) from public.partner_showcase_metrics())<>1 or
 exists(select 1 from public.partner_showcase_metrics() where project_id<>'00000000-0000-4000-8000-000000140005') then
 raise exception 'Second partner organization boundary leaked'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.partner_showcase_metrics()','execute') or has_function_privilege('anon','public.partner_update_lead(uuid,text,text)','execute') then raise exception 'Anonymous RPC access'; end if;
end $$;
rollback;
select 'Partner lead ownership, response attestation and scoped metrics: OK';
