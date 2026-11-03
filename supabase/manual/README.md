# Ручные SQL-скрипты для проекта OFFPLAN (Supabase `mfwbdfrrlckarktpwykf`)

Схема живой базы уже приведена к миграциям репозитория (до `20250414000005`), история миграций Supabase совпадает
с файлами в `supabase/migrations/`, поэтому `supabase db push` / workflow «Supabase migrations» работают штатно.

## Что осталось выполнить вручную

- **`02_seed_catalog.sql`** — посев 122 проектов каталога (аналог `npm run seed:catalog`), SQL Editor → New query → Run.
  Повторный запуск безопасен (upsert по `legacy_id`). Триггер `sync_catalog_facts` сам заполнит `developments` и
  `assessments`. Пока он не выполнен, публичный каталог пуст — это ожидаемо: в продакшене seed-JSON намеренно
  не подставляется вместо БД.
