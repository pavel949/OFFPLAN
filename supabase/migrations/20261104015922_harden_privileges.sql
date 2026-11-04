-- Hardening found during the live-database audit (2026-11-04).
--
-- 1. public_catalog_projects is an owner-rights, auto-updatable view and Supabase grants anon
--    ALL privileges on new relations by default => anyone holding the public key could UPDATE or
--    DELETE published catalogue rows through it (RLS is bypassed by the view owner), e.g. forge
--    verification_level. Same for the deals views with authenticated.
-- 2. (stale policies are dropped separately in 20261104015930_drop_stale_policies.sql)
-- 3. Privileges the API never needs (TRUNCATE, REFERENCES, TRIGGER, anon DML) are revoked and
--    default privileges are tightened so new tables do not repeat the problem.

-- 3. privileges ------------------------------------------------------------------------------
-- anon: read-only API role. Lead capture, analytics and all writes go through server code.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- views are read-only for every API role (owner-rights views would bypass RLS on writes)
do $$
declare v text;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', v);
  end loop;
end $$;

-- private tables: no anonymous SELECT at all (RLS already hides the rows; this removes the surface)
do $$
declare t text;
begin
  foreach t in array array[
    'leads', 'deals', 'ledger_entries', 'ledger_payments', 'deal_events',
    'commission_agreements', 'broker_terms', 'catalog_snapshots', 'assessments',
    'billing_customers', 'org_webhook_endpoints', 'project_documents', 'whatsapp_ingests',
    'correction_requests', 'moderation_submissions', 'favorites', 'project_subscriptions',
    'verification_cases', 'verification_items', 'verification_messages', 'verification_recusals',
    'project_commercial_interests', 'analytics_events', 'unit_price_history', 'catalog_audit_log'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke select on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- new relations / functions created later must not inherit the permissive defaults
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges in schema public revoke execute on functions from anon;
