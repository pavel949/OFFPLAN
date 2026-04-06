-- Seed from data/seed/*.json — run after migrations (adjust paths if using Supabase SQL editor)

insert into public.developers (code, name_en, name_ru) values
  ('SANS', 'Sansiri', 'Sansiri'),
  ('ORI', 'Origin', 'Origin'),
  ('LAG', 'Laguna', 'Laguna'),
  ('PHU', 'Phuket Prime', 'Phuket Prime')
on conflict (code) do nothing;

insert into public.zones (slug, label_en, label_ru, sort_order) values
  ('bang-tao', 'Bang Tao', 'Банг Тао', 10),
  ('surin', 'Surin', 'Сурин', 20),
  ('layan', 'Layan', 'Лаян', 30),
  ('rawai', 'Rawai', 'Раваи', 40),
  ('nai-harn', 'Nai Harn', 'Най Харн', 50),
  ('patong', 'Patong', 'Патонг', 60),
  ('kamala', 'Kamala', 'Камала', 70),
  ('cherngtalay', 'Cherngtalay', 'Чернгталай', 80),
  ('kata', 'Kata', 'Ката', 90),
  ('panwa', 'Panwa', 'Панва', 100),
  ('chalong', 'Chalong', 'Чалонг', 110),
  ('thalang', 'Thalang', 'Тхаланг', 120)
on conflict (slug) do nothing;

insert into public.catalog_meta (id, quarter_label, total_value_bn_thb, disclaimer_key) values
  (1, 'Q2 2026', 11.6, 'default')
on conflict (id) do update set quarter_label = excluded.quarter_label;

-- Example: one project row (expand from JSON export in production)
insert into public.projects (
  external_id, slug, name, seg, zone, st_k, rec, risk, dt,
  handover_year, beach, ownership, mgmt, focus, price_band, yield_guess, published
) values (
  'p001', 'azure-bang-tao', 'Azure Bang Tao', 'Beachfront', 'Bang Tao', 'Off-plan', 'BUY', 2, 'SANS',
  2026, 'Bang Tao', 'Leasehold', 'Rental', 'STR', 'Mid', 6.1, true
)
on conflict (slug) do nothing;
