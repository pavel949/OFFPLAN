-- Indexes for foreign-key columns that had none (found by schema audit).
-- Hot paths: project page (campaigns/subscriptions/favorites by project), RLS sub-selects on profiles.org_id,
-- partner views (correction_requests, deals), cascading deletes. All small tables today; cheap insurance.
create index if not exists profiles_org_idx on public.profiles (org_id);
create index if not exists sales_campaigns_project_idx on public.sales_campaigns (project_id);
create index if not exists favorites_project_idx on public.favorites (project_id);
create index if not exists project_subscriptions_project_idx on public.project_subscriptions (project_id);
create index if not exists correction_requests_project_idx on public.correction_requests (project_id);
create index if not exists correction_requests_org_idx on public.correction_requests (org_id);
create index if not exists deals_lead_idx on public.deals (lead_id);
create index if not exists deals_project_idx on public.deals (project_id);
create index if not exists deals_unit_idx on public.deals (unit_id);
create index if not exists leads_deal_idx on public.leads (deal_id);
create index if not exists leads_unit_idx on public.leads (unit_uuid);
create index if not exists moderation_submissions_entity_idx on public.moderation_submissions (entity_type, entity_id, status);
create index if not exists moderation_submissions_submitted_by_idx on public.moderation_submissions (submitted_by);
create index if not exists project_updates_created_by_idx on public.project_updates (created_by);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id);
create index if not exists catalog_audit_log_actor_idx on public.catalog_audit_log (actor_id);
