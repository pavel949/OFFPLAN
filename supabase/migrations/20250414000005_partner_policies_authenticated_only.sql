-- After P0 the anon role has no privilege on catalog_projects. Policies that sub-select it are evaluated for
-- every role they apply to, so an anonymous SELECT on project_updates / leads / moderation_submissions failed
-- with "permission denied for table catalog_projects" instead of returning zero rows.
-- These policies only make sense for signed-in users; scope them to the authenticated role.
alter policy "project_updates_partner_all" on public.project_updates to authenticated;
alter policy "leads_partner_read" on public.leads to authenticated;
alter policy "moderation_partner_read_scope" on public.moderation_submissions to authenticated;
alter policy "project_units_partner_delete" on public.project_units to authenticated;
alter policy "project_units_partner_rw" on public.project_units to authenticated;
alter policy "project_units_partner_update" on public.project_units to authenticated;
alter policy "sales_campaigns_partner_delete" on public.sales_campaigns to authenticated;
alter policy "sales_campaigns_partner_insert" on public.sales_campaigns to authenticated;
alter policy "sales_campaigns_partner_update" on public.sales_campaigns to authenticated;
