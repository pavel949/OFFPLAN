-- Add the fourth requested developer to the existing private source workspace.
-- Validate the replacement before removing the old check; keep all rows and grants.
alter table public.developer_import_projects
  add constraint developer_import_projects_developer_code_v2_check
  check (developer_code in ('DEV-BANYAN','DEV-SANSIRI','DEV-ASSETWISE','DEV-SUDARA')) not valid;
alter table public.developer_import_projects
  validate constraint developer_import_projects_developer_code_v2_check;
alter table public.developer_import_projects
  drop constraint developer_import_projects_developer_code_check;
