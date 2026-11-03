-- RLS regression tests. Run after all migrations on a database prepared with 00_supabase_stub.sql.
-- Any failed expectation raises an exception => non-zero exit with psql -v ON_ERROR_STOP=1.
grant all on all tables in schema public to anon, authenticated, service_role;

create or replace function pg_temp.as_user(uid uuid, r text) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when uid is null then 'anon' else 'authenticated' end, true);
end $$;

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL (expected error): %', label;
end $$;

create or replace function pg_temp.expect_count(sql text, want bigint, label text) returns void language plpgsql as $$
declare got bigint;
begin
  execute 'select count(*) from (' || sql || ') q' into got;
  if got <> want then raise exception 'FAIL: % (want %, got %)', label, want, got; end if;
end $$;

-- fixtures (as superuser; handle_new_user trigger creates buyer profiles)
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-0000000000a1','buyer@x'),
  ('00000000-0000-0000-0000-0000000000b1','partner@x'),
  ('00000000-0000-0000-0000-0000000000e1','staff@x');
insert into orgs(id,slug,name_en,name_ru) values ('00000000-0000-0000-0000-0000000000c1','o','O','O');
update profiles set role='partner', org_id='00000000-0000-0000-0000-0000000000c1', partner_role='owner' where id='00000000-0000-0000-0000-0000000000b1';
update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000e1';
insert into catalog_projects(id,slug,org_id,payload,draft_payload) values ('00000000-0000-0000-0000-0000000000d1','p','00000000-0000-0000-0000-0000000000c1','{"n":"orig","rec":"BUY","recText":"secret opinion"}','{"n":"unreleased draft"}');
insert into catalog_projects(id,slug,org_id,payload,moderation_status,is_published) values ('00000000-0000-0000-0000-0000000000d2','hidden','00000000-0000-0000-0000-0000000000c1','{"n":"hidden"}','draft',false);
insert into project_units(project_id,label) values ('00000000-0000-0000-0000-0000000000d1','PUB'),('00000000-0000-0000-0000-0000000000d2','HIDDEN');
insert into project_updates(project_id,title_en) values ('00000000-0000-0000-0000-0000000000d1','pub upd'),('00000000-0000-0000-0000-0000000000d2','hidden upd');
insert into leads(name,email,project_uuid) values ('l','l@l','00000000-0000-0000-0000-0000000000d1');
insert into catalog_snapshots(label,projects) values ('s','[]');

begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1','authenticated');
  select pg_temp.expect_error($$update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a1'$$, 'buyer self-promotes to admin');
  select pg_temp.expect_error($$update profiles set org_id='00000000-0000-0000-0000-0000000000c1' where id='00000000-0000-0000-0000-0000000000a1'$$, 'buyer self-assigns org');
  select pg_temp.expect_count($$select 1 from profiles where id='00000000-0000-0000-0000-0000000000a1'$$, 1, 'buyer reads own profile (no recursion)');
  select pg_temp.expect_count($$select 1 from leads$$, 0, 'buyer cannot read leads');
rollback;

begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1','authenticated');
  select pg_temp.expect_count($$select 1 from profiles where id='00000000-0000-0000-0000-0000000000b1'$$, 1, 'partner reads own profile');
  select pg_temp.expect_error($$update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000b1'$$, 'partner self-promotes');
  select pg_temp.expect_error($$update catalog_projects set payload='{"n":"HACK"}' where id='00000000-0000-0000-0000-0000000000d1'$$, 'partner overwrites published payload');
  select pg_temp.expect_error($$update catalog_projects set moderation_status='rejected' where id='00000000-0000-0000-0000-0000000000d1'$$, 'partner changes moderation status');
  select pg_temp.expect_error($$update catalog_projects set is_published=false where id='00000000-0000-0000-0000-0000000000d1'$$, 'partner changes is_published');
  select pg_temp.expect_error($$update catalog_projects set org_id=null where id='00000000-0000-0000-0000-0000000000d1'$$, 'partner changes org');
  update catalog_projects set draft_payload='{"n":"draft"}' where id='00000000-0000-0000-0000-0000000000d1';
  update catalog_projects set data_confirmed_at=now() where id='00000000-0000-0000-0000-0000000000d1';
  insert into project_units(project_id,label) values ('00000000-0000-0000-0000-0000000000d1','A1');
  select pg_temp.expect_count($$select 1 from leads$$, 1, 'partner reads leads of own project');
  select pg_temp.expect_count($$select 1 from org_webhook_endpoints$$, 0, 'partner cannot read webhook secrets');
  -- insert is forced to draft/unpublished
  insert into catalog_projects(slug,org_id,payload,moderation_status,is_published,legacy_id)
    values ('new','00000000-0000-0000-0000-0000000000c1','{}','published',true,999);
  select pg_temp.expect_count($$select 1 from catalog_projects where slug='new' and moderation_status='draft' and not is_published and legacy_id is null$$, 1, 'partner insert forced to draft');
rollback;

begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1','authenticated');
  select pg_temp.expect_count($$select 1 from leads$$, 1, 'admin reads leads');
  update catalog_projects set payload='{"n":"by admin"}' where id='00000000-0000-0000-0000-0000000000d1';
  update profiles set role='editor' where id='00000000-0000-0000-0000-0000000000a1';
rollback;

begin;
  select pg_temp.as_user(null,'anon');
  select pg_temp.expect_error($$insert into leads(name,email) values ('s','s@s')$$, 'anon inserts lead directly');
  select pg_temp.expect_count($$select 1 from catalog_snapshots$$, 0, 'anon cannot read snapshots');
  select pg_temp.expect_count($$select 1 from leads$$, 0, 'anon cannot read leads');
  select pg_temp.expect_count($$select 1 from platform_settings$$, 2, 'anon reads only the 2 public settings');
  -- public contract: the base table is closed, the view is the only door
  select pg_temp.expect_count($$select 1 from catalog_projects$$, 0, 'anon cannot read the base catalog_projects table');
  select pg_temp.expect_count($$select 1 from public_catalog_projects$$, 1, 'anon reads published projects via the view');
  select pg_temp.expect_count($$select 1 from public_catalog_projects where slug='hidden'$$, 0, 'view hides unpublished projects');
  select pg_temp.expect_error($$select draft_payload from public_catalog_projects$$, 'view must not expose draft_payload');
  select pg_temp.expect_count($$select 1 from public_catalog_projects where payload->>'rec'='WATCH' and payload->>'recText'='' and payload->>'n'='orig'$$, 1, 'view neutralises editorial rec/recText');
  select pg_temp.expect_count($$select 1 from public_catalog_projects where payload::text like '%secret%'$$, 0, 'no editorial text leaks through the view');
  -- children of published projects stay public, children of unpublished do not
  select pg_temp.expect_count($$select 1 from project_units$$, 1, 'anon sees units of published projects only');
  select pg_temp.expect_count($$select 1 from project_updates$$, 1, 'anon sees updates of published projects only');
rollback;

begin;
  -- a logged-in buyer is not staff: no draft_payload / editorial text of others' projects
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1','authenticated');
  select pg_temp.expect_count($$select 1 from catalog_projects$$, 0, 'buyer cannot read base catalog_projects');
  select pg_temp.expect_count($$select 1 from public_catalog_projects$$, 1, 'buyer reads the public view');
rollback;

-- atomic moderation functions: service role only, one transaction
insert into moderation_submissions(id,entity_type,entity_id,snapshot,status) values
  ('00000000-0000-0000-0000-0000000000f1','project','00000000-0000-0000-0000-0000000000d2','{"n":"approved snapshot"}','pending'),
  ('00000000-0000-0000-0000-0000000000f2','project','00000000-0000-0000-0000-0000000000d2','{"n":"x"}','pending');
update catalog_projects set moderation_status='pending_review' where id='00000000-0000-0000-0000-0000000000d2';

begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1','authenticated');
  select pg_temp.expect_error($$select moderation_approve('00000000-0000-0000-0000-0000000000f1')$$, 'even an admin session cannot call moderation_approve directly');
rollback;
begin;
  select pg_temp.as_user(null,'anon');
  select pg_temp.expect_error($$select moderation_reject('00000000-0000-0000-0000-0000000000f1','x')$$, 'anon cannot call moderation_reject');
rollback;

begin;
  set local role service_role;
  select moderation_approve('00000000-0000-0000-0000-0000000000f1');
  select pg_temp.expect_count($$select 1 from catalog_projects where id='00000000-0000-0000-0000-0000000000d2' and moderation_status='published' and is_published and payload->>'n'='approved snapshot' and draft_payload is null$$, 1, 'approve publishes snapshot atomically');
  select pg_temp.expect_count($$select 1 from moderation_submissions where id='00000000-0000-0000-0000-0000000000f1' and status='approved'$$, 1, 'approve marks submission');
  select pg_temp.expect_count($$select 1 from catalog_audit_log where entity_id='00000000-0000-0000-0000-0000000000f1' and action='moderation_approved'$$, 1, 'approve writes audit row');
  select pg_temp.expect_error($$select moderation_approve('00000000-0000-0000-0000-0000000000f1')$$, 'double approve is rejected');
  select pg_temp.expect_error($$select moderation_approve('00000000-0000-0000-0000-0000000000ff')$$, 'unknown submission is rejected');
  select moderation_reject('00000000-0000-0000-0000-0000000000f2','not good');
  select pg_temp.expect_count($$select 1 from moderation_submissions where id='00000000-0000-0000-0000-0000000000f2' and status='rejected' and reviewer_note='not good'$$, 1, 'reject records note');
rollback;

-- correction grant: org conflict aborts without partial writes
insert into orgs(id,slug,name_en,name_ru) values ('00000000-0000-0000-0000-0000000000c2','o2','O2','O2');
insert into correction_requests(id,project_id,org_id) values
  ('00000000-0000-0000-0000-0000000000a9','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c2');
begin;
  set local role service_role;
  select pg_temp.expect_error($$select correction_grant('00000000-0000-0000-0000-0000000000a9','n')$$, 'grant refused when project belongs to another org');
  select pg_temp.expect_count($$select 1 from correction_requests where id='00000000-0000-0000-0000-0000000000a9' and status='open'$$, 1, 'refused grant leaves request open');
rollback;

-- P1a: typed projection + assessments (parsing never guesses: unknown => NULL + warning)
insert into catalog_projects(id,slug,payload) values
 ('00000000-0000-0000-0000-0000000000d3','parse-a','{"n":"A","dev":"D","dt":"d","zone":"Layan","type":"condo","seg":"branded","stK":"building","beach":"bf","own":"fh","mgmt":"pro","focus":"lifestyle","pT":"฿17.3M","units":"455 (Park Residences phase)","unitSzM2":"2,452–3,281 sqm","yield":"5–7%","compY":2026,"compQ":"Dec 2026 / Q3 2027","rat":9.1,"risk":2,"rec":"BUY","recText":"x","src":"s"}'),
 ('00000000-0000-0000-0000-0000000000d4','parse-b','{"n":"B","zone":"Nowhere","pT":"฿315M+","units":"н/д","unitSzM2":"н/д","yield":"6%","compY":2027}'),
 ('00000000-0000-0000-0000-0000000000d5','parse-c','{"n":"C","zone":"Kata","pT":"฿5M–฿8.5M","units":"~40","unitSzM2":"Studio–3BR","yield":"n/a"}'),
 ('00000000-0000-0000-0000-0000000000d6','parse-d','{"n":"D","zone":"Kata","pT":"POA"}'),
 ('00000000-0000-0000-0000-0000000000d7','parse-e','{"n":"E","zone":"Kata","pT":"garbage"}');
select pg_temp.expect_count($$select 1 from developments where project_id='00000000-0000-0000-0000-0000000000d3' and price_status='quoted' and price_from_thb=17300000 and price_to_thb is null and not price_open_ended and units_total=455 and unit_size_min_sqm=2452 and unit_size_max_sqm=3281 and yield_min_pct=5 and yield_max_pct=7 and completion_year=2026 and area_id is not null and parse_warnings='{}'$$, 1, 'typed projection parses a well-formed payload');
select pg_temp.expect_count($$select 1 from developments where project_id='00000000-0000-0000-0000-0000000000d4' and price_from_thb=315000000 and price_open_ended and units_total is null and unit_size_min_sqm is null and yield_min_pct=6 and yield_max_pct=6 and area_id is null and parse_warnings='{zone_unmapped}'$$, 1, 'open-ended price, н/д stays NULL without warning, unmapped zone is flagged');
select pg_temp.expect_count($$select 1 from developments where project_id='00000000-0000-0000-0000-0000000000d5' and price_from_thb=5000000 and price_to_thb=8500000 and units_total=40 and parse_warnings @> '{unit_size_unparsed,yield_unparsed}'$$, 1, 'price range parsed, free text flagged not guessed');
select pg_temp.expect_count($$select 1 from developments where project_id='00000000-0000-0000-0000-0000000000d6' and price_status='on_request' and price_from_thb is null$$, 1, 'POA => on_request');
select pg_temp.expect_count($$select 1 from developments where project_id='00000000-0000-0000-0000-0000000000d7' and price_status='unknown' and 'price_unparsed'=any(parse_warnings)$$, 1, 'unparsable price flagged');
select pg_temp.expect_count($$select 1 from assessments where project_id='00000000-0000-0000-0000-0000000000d3' and is_current and rating=9.1 and risk=2 and label='BUY' and visibility='internal'$$, 1, 'assessment extracted, internal by default');
update catalog_projects set payload = jsonb_set(payload,'{rec}','"AVOID"') where id='00000000-0000-0000-0000-0000000000d3';
select pg_temp.expect_count($$select 1 from assessments where project_id='00000000-0000-0000-0000-0000000000d3'$$, 2, 'assessment history is kept');
select pg_temp.expect_count($$select 1 from assessments where project_id='00000000-0000-0000-0000-0000000000d3' and is_current and label='AVOID'$$, 1, 'exactly one current assessment');
update catalog_projects set payload = jsonb_set(payload,'{n}','"A renamed"') where id='00000000-0000-0000-0000-0000000000d3';
select pg_temp.expect_count($$select 1 from assessments where project_id='00000000-0000-0000-0000-0000000000d3'$$, 2, 'unrelated edit does not create a new assessment');
select pg_temp.expect_error($$update assessments set visibility='public' where project_id='00000000-0000-0000-0000-0000000000d3' and is_current$$, 'cannot publish an assessment without legal sign-off');

begin;
  select pg_temp.as_user(null,'anon');
  select pg_temp.expect_count($$select 1 from assessments$$, 0, 'anon cannot read assessments');
  select pg_temp.expect_count($$select 1 from developments$$, 6, 'anon reads typed facts of published projects only');
  select pg_temp.expect_count($$select 1 from developments where slug='hidden'$$, 0, 'unpublished project facts are not public');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1','authenticated');
  select pg_temp.expect_count($$select 1 from assessments$$, 0, 'buyer cannot read assessments');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1','authenticated');
  select pg_temp.expect_count($$select 1 from assessments$$, 0, 'partner cannot read assessments');
rollback;

-- service role / direct connection stays unrestricted (trusted server code)
update profiles set role='buyer' where id='00000000-0000-0000-0000-0000000000e1';
select 'RLS OK' as result;
