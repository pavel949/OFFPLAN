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
insert into catalog_projects(id,slug,org_id,payload) values ('00000000-0000-0000-0000-0000000000d1','p','00000000-0000-0000-0000-0000000000c1','{"n":"orig"}');
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
  select pg_temp.expect_count($$select 1 from catalog_projects where is_published$$, 1, 'anon reads published projects');
rollback;

-- service role / direct connection stays unrestricted (trusted server code)
update profiles set role='buyer' where id='00000000-0000-0000-0000-0000000000e1';
select 'RLS OK' as result;
