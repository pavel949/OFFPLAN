-- Supabase security advisor follow-ups (function exposure through /rest/v1/rpc).
--  * trigger functions must never be callable through the API; they fire as triggers without caller EXECUTE
--  * has_pending_submission() is only evaluated for signed-in partners (revoke from anon)
--  * pin search_path on the pure helper
-- The RLS helpers is_staff / is_admin / is_public_project intentionally stay executable by anon/authenticated:
-- policies call them with the caller's privileges.
revoke execute on function public.catalog_projects_guard() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_guard() from public, anon, authenticated;
revoke execute on function public.sync_catalog_facts() from public, anon, authenticated;
revoke execute on function public.has_pending_submission(uuid) from anon;
alter function public.parse_money_token(text, text) set search_path = pg_catalog;
