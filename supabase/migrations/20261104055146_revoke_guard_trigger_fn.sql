-- Trigger functions are never meant to be called through the API.
revoke execute on function public.project_sources_guard() from authenticated;
