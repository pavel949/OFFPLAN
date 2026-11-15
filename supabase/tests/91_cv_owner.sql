-- Platform owner: edits and publishes methodology alone, but publication is never silent and the rules stay enforced.
create or replace function pg_temp.as_caller(uid uuid, r text, email text default null) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when r = 'service_role' then 'service_role' when uid is null then 'anon' else 'authenticated' end, true);
  perform set_config('request.jwt.claims', case when email is null then '{}' else json_build_object('email', email)::text end, true);
end $$;
create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;

insert into cv_methodology_versions (id, jurisdiction_code, version, title, config)
values ('00000000-0000-0000-0000-0000000d0001', 'TH', '8.8.1', 'owner test 1', '{"a":1}'),
       ('00000000-0000-0000-0000-0000000d0002', 'TH', '8.8.2', 'owner test 2', '{"a":2}'),
       ('00000000-0000-0000-0000-0000000d0003', 'TH', '8.8.3', 'owner test 3', '{"a":3}');

-- who is the owner
begin;
  select pg_temp.as_caller(null, 'anon');
  select pg_temp.expect_error($$select is_platform_owner()$$, 'anon cannot even call is_platform_owner');
rollback;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f001', 'authenticated', 'someone@else.com');
  select case when not is_platform_owner() then 'ok' else 'FAIL: stranger is owner' end;
  select pg_temp.expect_error($$select email from platform_owners$$, 'nobody can read the owners table');
rollback;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f001', 'authenticated', 'PAVEL@IgnatevEstate.com');
  select case when is_platform_owner() then 'ok' else 'FAIL: owner not recognised (case-insensitive)' end;
rollback;

-- the server-side owner path
begin;
  select pg_temp.as_caller(null, 'service_role');
  select pg_temp.expect_error($$select cv_owner_publish('00000000-0000-0000-0000-0000000d0001', 'someone@else.com', 'A sufficiently long change summary')$$, 'a stranger email cannot publish');
  select pg_temp.expect_error($$select cv_owner_publish('00000000-0000-0000-0000-0000000d0001', 'pavel@ignatevestate.com', 'short')$$, 'the summary must be descriptive');
  select cv_owner_publish('00000000-0000-0000-0000-0000000d0001', 'pavel@ignatevestate.com', 'Owner publishes the first test version alone');
commit;
select case when status = 'published' and approval_mode = 'owner' and config_hash ~ '^[0-9a-f]{64}$' then 'ok' else 'FAIL owner publication' end
from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000d0001';

-- the mode is public, the content is not, and it is immutable
begin;
  select pg_temp.as_caller(null, 'anon');
  select case when (select approval_mode from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000d0001') = 'owner' then 'ok' else 'FAIL: mode not public' end;
  select pg_temp.expect_error($$select config from cv_methodology_versions$$, 'content still private');
rollback;
begin;
  select pg_temp.as_caller(null, 'service_role');
  select pg_temp.expect_error($$update cv_methodology_versions set approval_mode = 'dual' where id = '00000000-0000-0000-0000-0000000d0001'$$, 'approval mode of a published version is immutable');
rollback;

-- the owner as a reviewer publishes alone; a normal reviewer does not
begin;
  select pg_temp.as_caller(null, 'service_role');
  select cv_submit_for_review('00000000-0000-0000-0000-0000000d0002', 'Second owner test version, submitted for review');
commit;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f101', 'authenticated', 'r1@x');
  select case when cv_review_version('00000000-0000-0000-0000-0000000d0002', 'approve', '') = 'approved_waiting' then 'ok' else 'FAIL: ordinary reviewer published alone' end;
commit;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f102', 'authenticated', 'pavel@ignatevestate.com');
  select case when cv_review_version('00000000-0000-0000-0000-0000000d0002', 'approve', '') = 'published' then 'ok' else 'FAIL: owner reviewer did not publish alone' end;
commit;
select case when status = 'published' and approval_mode = 'owner' then 'ok' else 'FAIL second owner publication' end from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000d0002';
select case when status = 'retired' then 'ok' else 'FAIL: previous version not retired' end from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000d0001';

-- switching sole approval off restores the two-reviewer rule for everyone, owner included
update platform_settings set value = 'false'::jsonb where key = 'cv_owner_sole_approval';
begin;
  select pg_temp.as_caller(null, 'service_role');
  select pg_temp.expect_error($$select cv_owner_publish('00000000-0000-0000-0000-0000000d0003', 'pavel@ignatevestate.com', 'Third attempt while sole approval is off')$$, 'owner cannot publish alone when sole approval is off');
  select cv_submit_for_review('00000000-0000-0000-0000-0000000d0003', 'Third version goes the two-reviewer way');
commit;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f102', 'authenticated', 'pavel@ignatevestate.com');
  select case when cv_review_version('00000000-0000-0000-0000-0000000d0003', 'approve', '') = 'approved_waiting' then 'ok' else 'FAIL: owner published alone while the switch is off' end;
commit;
begin;
  select pg_temp.as_caller('00000000-0000-0000-0000-00000000f101', 'authenticated', 'r1@x');
  select case when cv_review_version('00000000-0000-0000-0000-0000000d0003', 'approve', '') = 'published' then 'ok' else 'FAIL: two approvals did not publish' end;
commit;
select case when approval_mode = 'dual' then 'ok' else 'FAIL: dual mode not recorded' end from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000d0003';
update platform_settings set value = 'true'::jsonb where key = 'cv_owner_sole_approval';
select 'CV OWNER OK' as result;
