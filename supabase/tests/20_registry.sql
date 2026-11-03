-- Verification registry tests (run after 10_rls_hardening.sql on the same database).
grant all on all tables in schema public to anon, authenticated, service_role;

create or replace function pg_temp.as_user(uid uuid, r text) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when uid is null then 'anon' else 'authenticated' end, true);
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

-- fixtures ---------------------------------------------------------------
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-00000000f001','dev@x'),      -- developer (partner)
  ('00000000-0000-0000-0000-00000000f002','dev2@x'),     -- other developer
  ('00000000-0000-0000-0000-00000000f101','r1@x'),       -- reviewers
  ('00000000-0000-0000-0000-00000000f102','r2@x'),
  ('00000000-0000-0000-0000-00000000f103','r3-broker@x'),
  ('00000000-0000-0000-0000-00000000f201','admin@x');    -- broker-side platform admin
insert into orgs(id,slug,name_en,name_ru,kind) values
  ('00000000-0000-0000-0000-00000000fa01','dev-org','Dev','Dev','developer'),
  ('00000000-0000-0000-0000-00000000fa02','dev-org-2','Dev2','Dev2','developer'),
  ('00000000-0000-0000-0000-00000000fb01','broker-org','Broker','Broker','broker');
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000fa01', partner_role='owner' where id='00000000-0000-0000-0000-00000000f001';
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000fa02', partner_role='owner' where id='00000000-0000-0000-0000-00000000f002';
update profiles set role='reviewer' where id in ('00000000-0000-0000-0000-00000000f101','00000000-0000-0000-0000-00000000f102');
update profiles set role='reviewer', org_id='00000000-0000-0000-0000-00000000fb01' where id='00000000-0000-0000-0000-00000000f103';
update profiles set role='admin', org_id='00000000-0000-0000-0000-00000000fb01' where id='00000000-0000-0000-0000-00000000f201';
insert into catalog_projects(id,slug,org_id,payload) values
  ('00000000-0000-0000-0000-00000000fc01','reg-p1','00000000-0000-0000-0000-00000000fa01','{"n":"P1"}');
insert into project_commercial_interests(project_id, org_id, kind) values
  ('00000000-0000-0000-0000-00000000fc01','00000000-0000-0000-0000-00000000fb01','broker_agreement');

-- 1. who can start a case ---------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f002','authenticated');
  select pg_temp.expect_error($$select start_verification_case('00000000-0000-0000-0000-00000000fc01', 1::smallint)$$, 'other developer cannot start a case');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f201','authenticated');
  select pg_temp.expect_error($$select start_verification_case('00000000-0000-0000-0000-00000000fc01', 1::smallint)$$, 'broker admin cannot start a case');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select pg_temp.expect_error($$select start_verification_case('00000000-0000-0000-0000-00000000fc01', 2::smallint)$$, 'level 2 requires valid level 1');
  select start_verification_case('00000000-0000-0000-0000-00000000fc01', 1::smallint) is not null;
  select pg_temp.expect_count($$select 1 from verification_items$$, 8, 'checklist items created from the template');
  select pg_temp.expect_error($$select start_verification_case('00000000-0000-0000-0000-00000000fc01', 1::smallint)$$, 'only one open case per level');
commit;

-- 2. evidence + submit --------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select pg_temp.expect_error($$select submit_verification_case((select id from verification_cases limit 1))$$, 'cannot submit without evidence');
  do $$ declare k text; cid uuid; begin
    select id into cid from verification_cases limit 1;
    for k in select item_key from verification_items where required loop
      perform attach_verification_evidence(cid, k, 'p/' || k || '.pdf', k || '.pdf', 1000);
    end loop;
    perform submit_verification_case(cid);
  end $$;
  select pg_temp.expect_count($$select 1 from verification_cases where status='submitted'$$, 1, 'case submitted');
commit;

-- 3. claiming: only reviewers without conflict -----------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f201','authenticated');
  select pg_temp.expect_error($$select claim_verification_case((select id from verification_cases limit 1))$$, 'admin (broker side) cannot claim');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select pg_temp.expect_error($$select claim_verification_case((select id from verification_cases limit 1))$$, 'developer cannot claim');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f103','authenticated');
  select pg_temp.expect_error($$select claim_verification_case((select id from verification_cases limit 1))$$, 'reviewer of the broker with a declared interest is conflicted');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101','authenticated');
  select claim_verification_case((select id from verification_cases limit 1));
  select pg_temp.expect_count($$select 1 from verification_cases where status='in_review' and assigned_reviewer='00000000-0000-0000-0000-00000000f101'$$, 1, 'R1 claimed the case');
commit;

-- 4. item review by the assigned reviewer only --------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102','authenticated');
  select pg_temp.expect_error($$select review_verification_item((select id from verification_cases limit 1), 'land_title', 'verified', 'ok')$$, 'non-assigned reviewer cannot check items');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101','authenticated');
  select review_verification_item((select id from verification_cases limit 1), 'land_title', 'verified', 'ok');
  select pg_temp.expect_error($$select decide_verification((select id from verification_cases limit 1), 'approved', 'Все документы проверены, замечаний нет.')$$, 'four eyes: R1 cannot decide own review');
commit;

-- 5. decision rules ----------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102','authenticated');
  select pg_temp.expect_error($$select decide_verification((select id from verification_cases limit 1), 'approved', 'short')$$, 'public summary required');
  select pg_temp.expect_error($$select decide_verification((select id from verification_cases limit 1), 'approved', 'Все документы проверены, замечаний нет.')$$, 'cannot approve with unverified required items');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101','authenticated');
  do $$ declare k text; cid uuid; begin
    select id into cid from verification_cases limit 1;
    for k in select item_key from verification_items where required and status <> 'verified' loop
      perform review_verification_item(cid, k, 'verified', 'ok');
    end loop;
  end $$;
commit;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select pg_temp.expect_error($$update catalog_projects set verification_level = 2 where id='00000000-0000-0000-0000-00000000fc01'$$, 'developer cannot set verification level');
  select pg_temp.expect_error($$select decide_verification((select id from verification_cases limit 1), 'approved', 'Я сам себя верифицировал, всё хорошо.')$$, 'developer cannot decide');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f201','authenticated');
  select pg_temp.expect_error($$update catalog_projects set verification_level = 2 where id='00000000-0000-0000-0000-00000000fc01'$$, 'platform admin cannot set verification level');
  select pg_temp.expect_error($$select decide_verification((select id from verification_cases limit 1), 'approved', 'Админ платформы не должен решать.')$$, 'platform admin cannot decide');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102','authenticated');
  select decide_verification((select id from verification_cases limit 1), 'approved', 'Все документы проверены, замечаний нет.');
commit;

-- 6. result is public, immutable, outcome does not touch the fee ----------------------
begin;
  select pg_temp.as_user(null,'anon');
  select pg_temp.expect_count($$select 1 from verification_events where event='approved'$$, 1, 'approval is in the public log');
  select pg_temp.expect_count($$select 1 from verification_cases$$, 0, 'anon cannot read cases');
  select pg_temp.expect_count($$select 1 from verification_checklist_templates$$, 2, 'methodology (templates) is public');
rollback;
select pg_temp.expect_count($$select 1 from catalog_projects where id='00000000-0000-0000-0000-00000000fc01' and verification_level=1 and verification_expires_at > now() + interval '11 months'$$, 1, 'project level 1 valid for ~12 months');
select pg_temp.expect_error($$update verification_cases set status='rejected' where status='approved'$$, 'decided cases are immutable');
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f002','authenticated');
  select pg_temp.expect_count($$select 1 from verification_cases$$, 0, 'other developer cannot read the case');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select pg_temp.expect_count($$select 1 from verification_cases$$, 1, 'developer reads own case');
  select pg_temp.expect_count($$select 1 from verification_items$$, 8, 'developer reads own items');
rollback;

-- 7. messages (right of reply) and recusal -------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select post_verification_message((select id from verification_cases limit 1), 'Просим учесть обновлённый график платежей.');
  select pg_temp.expect_count($$select 1 from verification_messages where author_side='developer'$$, 1, 'developer can reply');
commit;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f103','authenticated');
  select pg_temp.expect_error($$select post_verification_message((select id from verification_cases limit 1), 'Я из брокера')$$, 'conflicted reviewer cannot post');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f102','authenticated');
  select recuse_from_case((select id from verification_cases limit 1), 'Личная связь с застройщиком');
  select pg_temp.expect_error($$select post_verification_message((select id from verification_cases limit 1), 'после отвода')$$, 'recused reviewer cannot act');
commit;

-- 8. level 2 and revocation -----------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f001','authenticated');
  select start_verification_case('00000000-0000-0000-0000-00000000fc01', 2::smallint) is not null;
commit;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000f101','authenticated');
  select pg_temp.expect_error($$select revoke_verification('00000000-0000-0000-0000-00000000fc01', 'мало')$$, 'revocation needs a reason');
  select revoke_verification('00000000-0000-0000-0000-00000000fc01', 'Выявлено несоответствие данных о титуле документам реестра.');
commit;
select pg_temp.expect_count($$select 1 from catalog_projects where id='00000000-0000-0000-0000-00000000fc01' and verification_level=0$$, 1, 'revocation drops the level');
select pg_temp.expect_count($$select 1 from verification_events where event='revoked'$$, 1, 'revocation is logged publicly');

select 'REGISTRY OK' as result;
