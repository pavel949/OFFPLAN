-- OFFPLAN (необязательно): привести историю миграций Supabase CLI к файлам репозитория.
-- Нужно, чтобы работал `supabase db push` / workflow "Supabase migrations": три первые миграции записаны
-- с версиями 20261103..., из-за чего CLI считает историю расходящейся. Запускать ПОСЛЕ 01_migrations.sql.
begin;
update supabase_migrations.schema_migrations set version = '20250402000000' where name = 'init';
update supabase_migrations.schema_migrations set version = '20250402000001' where name = 'catalog_snapshots_and_payload';
update supabase_migrations.schema_migrations set version = '20250403000000' where name = 'leads';
insert into supabase_migrations.schema_migrations (version, name) values
  ('20250404000000', 'platform_v1'),
  ('20250406100000', 'moderation_enhancements'),
  ('20250406100001', 'moderation_partner_read_scope'),
  ('20250407100000', 'admin_brain'),
  ('20250408000000', 'marketplace_phases_0_5'),
  ('20250409000000', 'security_hardening'),
  ('20250409000001', 'leads_consent'),
  ('20250414000000', 'p0_public_surface'),
  ('20250414000001', 'p1a_typed_catalog'),
  ('20250414000002', 'fk_indexes'),
  ('20250414000003', 'p0_compat_registry_i18n')
on conflict (version) do nothing;
commit;

select version, name from supabase_migrations.schema_migrations order by version;
