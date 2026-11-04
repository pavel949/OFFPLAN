-- ClearView methodology versions: private content, two-reviewer publication, immutability.
grant all on all tables in schema public to anon, authenticated, service_role;
\i supabase/migrations/20261104140000_cv_methodology.sql

create or replace function pg_temp.as_user(uid uuid, r text) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when r = 'service_role' then 'service_role' when uid is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;
create or replace function pg_temp.expect_count(sql text, want bigint, label text) returns void language plpgsql as $$
declare got bigint;
begin
  execute 'select count(*) from (' || sql || ') q' into got;
  if got <> want then raise exception 'FAIL: % (want %, got %)', label, want, got; end if;
end $$;

-- fixtures: reviewers f101, f102 and the developer f001 come from the registry tests
insert into cv_methodology_versions (id, jurisdiction_code, version, title, config)
values ('00000000-0000-0000-0000-0000000c0001', 'TH', '9.9.1', 'test', '{"domains":[{"code":"D1","base":1}]}');

-- the owner (service role) submits it
begin;
  select pg_temp.as_user(null, 'service_role');
  select pg_temp.expect_error($$select cv_submit_for_review('00000000-0000-0000-0000-0000000c0001', 'short')$$, 'summary must be descriptive');
  select cv_submit_for_review('00000000-0000-0000-0000-0000000c0001', 'First version for the test of the approval flow');
commit;

-- anonymous: nothing visible while in review, and never the content
begin;
  select pg_temp.as_user(null, 'anon');
  select pg_temp.expect_count($$select id from cv_methodology_versions$$, 0, 'anon sees no draft or review versions');
  select pg_temp.expect_error($$select config from cv_methodology_versions$$, 'anon cannot select the config column');
  select pg_temp.expect_error($$select cv_version_config('00000000-0000-0000-0000-0000000c0001')$$, 'anon cannot call cv_version_config');
  select pg_temp.expect_error($$select cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '')$$, 'anon cannot review');
rollback;

-- a developer is not a reviewer
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001', 'authenticated');
  select pg_temp.expect_error($$select cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '')$$, 'non-reviewer cannot review');
  select pg_temp.expect_count($$select id from cv_methodology_versions$$, 0, 'developer sees nothing under review');
  select pg_temp.expect_count($$select * from cv_approval_status('00000000-0000-0000-0000-0000000c0001')$$, 0, 'non-reviewer gets no review status');
rollback;

-- first approval does not publish; the same reviewer cannot approve twice to reach two
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101', 'authenticated');
  select pg_temp.expect_count($$select cv_version_config('00000000-0000-0000-0000-0000000c0001')$$, 1, 'reviewer reads the config under review');
  select pg_temp.expect_count($$select id from cv_methodology_versions where status = 'review'$$, 1, 'reviewer lists versions under review');
  select pg_temp.expect_error($$select config from cv_methodology_versions$$, 'even a reviewer cannot select the config column directly');
  select case when cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '') = 'approved_waiting' then 'ok' else 'FAIL first approval' end;
  select pg_temp.expect_count($$select * from cv_approval_status('00000000-0000-0000-0000-0000000c0001') where approvals = 1 and mine = 'approve'$$, 1, 'reviewer sees own approval and the count');
  select case when cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '') = 'approved_waiting' then 'ok' else 'FAIL same reviewer twice' end;
commit;
select case when status = 'review' then 'ok' else 'FAIL: one reviewer published' end from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0001';

-- a return sends it back to draft; a re-submission clears decisions
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102', 'authenticated');
  select pg_temp.expect_error($$select cv_review_version('00000000-0000-0000-0000-0000000c0001', 'return', 'x')$$, 'a return needs an explanation');
  select case when cv_review_version('00000000-0000-0000-0000-0000000c0001', 'return', 'Weights of D2 look too low for pre-launch') = 'returned' then 'ok' else 'FAIL return' end;
commit;
select case when status = 'draft' then 'ok' else 'FAIL: return did not reopen the draft' end from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0001';
begin;
  select pg_temp.as_user(null, 'service_role');
  select cv_submit_for_review('00000000-0000-0000-0000-0000000c0001', 'Second attempt after the reviewers comments');
commit;
select case when count(*) = 0 then 'ok' else 'FAIL: old decisions survived resubmission' end from cv_methodology_approvals where version_id = '00000000-0000-0000-0000-0000000c0001';

-- two distinct reviewers publish
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101', 'authenticated');
  select cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '');
commit;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102', 'authenticated');
  select case when cv_review_version('00000000-0000-0000-0000-0000000c0001', 'approve', '') = 'published' then 'ok' else 'FAIL second approval did not publish' end;
commit;

select case when status = 'published' and config_hash ~ '^[0-9a-f]{64}$' and published_at is not null then 'ok' else 'FAIL published state' end
from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0001';

-- public sees the fingerprint, never the content
begin;
  select pg_temp.as_user(null, 'anon');
  select pg_temp.expect_count($$select version, config_hash from cv_methodology_versions where status = 'published'$$, 1, 'anon reads published version fingerprints');
  select pg_temp.expect_error($$select config from cv_methodology_versions$$, 'anon still cannot read the content');
  select pg_temp.expect_error($$update cv_methodology_versions set title = 'x'$$, 'anon cannot update');
rollback;

-- immutability, even for the service role
begin;
  select pg_temp.as_user(null, 'service_role');
  select pg_temp.expect_error($$update cv_methodology_versions set config = '{}' where id = '00000000-0000-0000-0000-0000000c0001'$$, 'published config is immutable');
  select pg_temp.expect_error($$update cv_methodology_versions set config_hash = repeat('a', 64) where id = '00000000-0000-0000-0000-0000000c0001'$$, 'published hash is immutable');
  select pg_temp.expect_error($$delete from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0001'$$, 'published version cannot be deleted');
rollback;

-- a newer version retires the previous one
insert into cv_methodology_versions (id, jurisdiction_code, version, title, config, based_on)
values ('00000000-0000-0000-0000-0000000c0002', 'TH', '9.9.2', 'test 2', '{"domains":[{"code":"D1","base":1}],"changed":true}', '00000000-0000-0000-0000-0000000c0001');
begin;
  select pg_temp.as_user(null, 'service_role');
  select cv_submit_for_review('00000000-0000-0000-0000-0000000c0002', 'Changed something, see the diff in the studio');
commit;
begin; select pg_temp.as_user('00000000-0000-0000-0000-00000000f101', 'authenticated'); select cv_review_version('00000000-0000-0000-0000-0000000c0002', 'approve', ''); commit;
begin; select pg_temp.as_user('00000000-0000-0000-0000-00000000f102', 'authenticated'); select cv_review_version('00000000-0000-0000-0000-0000000c0002', 'approve', ''); commit;
select case when (select status from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0001') = 'retired'
              and (select status from cv_methodology_versions where id = '00000000-0000-0000-0000-0000000c0002') = 'published'
            then 'ok' else 'FAIL: old version was not retired' end;
select 'CV METHODOLOGY OK' as result;
