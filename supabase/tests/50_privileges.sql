-- Privilege / legacy-policy regression tests. Simulates Supabase's permissive default grants,
-- re-applies the hardening migration (idempotent) and checks what the API roles can really do.
grant all on all tables in schema public to anon, authenticated, service_role;
\i supabase/migrations/20261104000000_harden_privileges_and_legacy_policies.sql

create or replace function pg_temp.as_role(r text, uid uuid default null) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', r, true);
end $$;
create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;
create or replace function pg_temp.expect_ok(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise exception 'FAIL (unexpected error: %): %', sqlerrm, label; end;
end $$;

-- legacy policies are gone
select case when count(*) = 0 then 'ok' else (select string_agg(policyname, ',') from pg_policies where policyname in ('leads_insert_anon','leads_read_editor','leads_update_editor','catalog_snapshots_read_anon','catalog_snapshots_write_editor')) end as legacy_policies
from pg_policies where policyname in ('leads_insert_anon','leads_read_editor','leads_update_editor','catalog_snapshots_read_anon','catalog_snapshots_write_editor');

-- a published project to attack
insert into catalog_projects(id, legacy_id, slug, payload, is_published, moderation_status)
values ('00000000-0000-0000-0000-00000000a501', 90501, 'priv-test', '{"n":"Priv"}', true, 'published')
on conflict do nothing;

begin;
  select pg_temp.as_role('anon');
  -- everything the public site reads must keep working for anon
  select pg_temp.expect_ok($$select count(*) from public_catalog_projects$$, 'anon reads public_catalog_projects');
  select pg_temp.expect_ok($$select count(*) from public_project_inventory$$, 'anon reads public_project_inventory');
  select pg_temp.expect_ok($$select count(*) from catalog_project_translations$$, 'anon reads translations');
  select pg_temp.expect_ok($$select count(*) from project_units$$, 'anon reads project_units');
  select pg_temp.expect_ok($$select count(*) from sales_campaigns$$, 'anon reads sales_campaigns');
  select pg_temp.expect_ok($$select count(*) from project_updates$$, 'anon reads project_updates');
  select pg_temp.expect_ok($$select count(*) from project_evidence$$, 'anon reads project_evidence');
  select pg_temp.expect_ok($$select count(*) from platform_settings$$, 'anon reads platform_settings');
  select pg_temp.expect_ok($$select count(*) from verification_checklist_templates$$, 'anon reads checklist templates');
  select pg_temp.expect_ok($$select count(*) from verification_events$$, 'anon reads registry log');
  select pg_temp.expect_ok($$select count(*) from jurisdictions$$, 'anon reads jurisdictions');
  select pg_temp.expect_ok($$select count(*) from regions$$, 'anon reads regions');
  select pg_temp.expect_ok($$select count(*) from taxonomy_terms$$, 'anon reads taxonomy');
  -- and nothing else
  select pg_temp.expect_error($$update public_catalog_projects set verification_level = 2$$, 'anon cannot UPDATE the public view');
  select pg_temp.expect_error($$delete from public_catalog_projects$$, 'anon cannot DELETE through the public view');
  select pg_temp.expect_error($$insert into public_catalog_projects(slug) values ('x')$$, 'anon cannot INSERT through the public view');
  select pg_temp.expect_error($$insert into leads(name,email) values ('a','a@a')$$, 'anon cannot insert leads');
  select pg_temp.expect_error($$select count(*) from leads$$, 'anon has no SELECT on leads');
  select pg_temp.expect_error($$select count(*) from catalog_snapshots$$, 'anon cannot read snapshots');
  select pg_temp.expect_error($$select count(*) from deals$$, 'anon cannot read deals');
  select pg_temp.expect_error($$update catalog_projects set slug = 'hacked'$$, 'anon cannot update the base table');
  select pg_temp.expect_error($$truncate catalog_projects$$, 'anon cannot truncate');
rollback;

begin;
  select pg_temp.as_role('authenticated', '00000000-0000-0000-0000-00000000a502');
  select pg_temp.expect_error($$update public_catalog_projects set verification_level = 2$$, 'authenticated cannot UPDATE the public view');
  select pg_temp.expect_error($$update developer_deals_v set commission_gross = 0$$, 'authenticated cannot UPDATE the developer deals view');
  select pg_temp.expect_error($$update broker_deals_v set broker_net = 0$$, 'authenticated cannot UPDATE the broker deals view');
  select pg_temp.expect_error($$delete from developer_deals_v$$, 'authenticated cannot DELETE through the deals view');
  select pg_temp.expect_error($$truncate deals$$, 'authenticated cannot truncate');
  select pg_temp.expect_ok($$select count(*) from developer_deals_v$$, 'authenticated can still read its deals view');
rollback;

-- published data is untouched
select pg_temp.expect_ok($$select 1 from catalog_projects where slug = 'priv-test' and verification_level = 0$$, 'verification level untouched');
delete from catalog_projects where slug = 'priv-test';
select 'PRIVILEGES OK' as result;
