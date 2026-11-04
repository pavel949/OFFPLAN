-- Drops five first-iteration permissive policies still present in the live DB (anon INSERT into leads,
-- anon SELECT on catalog_snapshots, ...). Destructive => needs owner confirmation when applied via MCP.
drop policy if exists "leads_insert_anon" on public.leads;
drop policy if exists "leads_read_editor" on public.leads;
drop policy if exists "leads_update_editor" on public.leads;
drop policy if exists "catalog_snapshots_read_anon" on public.catalog_snapshots;
drop policy if exists "catalog_snapshots_write_editor" on public.catalog_snapshots;
