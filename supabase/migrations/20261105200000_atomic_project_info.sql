-- Operator save is one transaction: references, project payload and audit either
-- all commit or all roll back. No existing rows are changed by this migration.
create or replace function public.admin_save_project_info(
  p_project_id uuid, p_expected_updated_at timestamptz, p_expected_payload jsonb,
  p_payload jsonb, p_region jsonb, p_developer jsonb, p_confirm boolean
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  project public.catalog_projects%rowtype;
  region public.regions%rowtype;
  parent_region public.regions%rowtype;
  developer public.developers%rowtype;
  merged jsonb;
  changed jsonb;
begin
  if current_user not in ('service_role','postgres') then raise exception 'admin only'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_region) is distinct from 'object'
     or jsonb_typeof(p_developer) is distinct from 'object' then raise exception 'invalid save request'; end if;
  select * into project from public.catalog_projects where id=p_project_id for update;
  if not found then raise exception 'project not found'; end if;
  if project.updated_at is distinct from p_expected_updated_at or project.payload is distinct from p_expected_payload then
    raise exception 'project changed';
  end if;
  -- Do not permit the request to replace the project's stable catalogue identity.
  if p_payload->'id' is distinct from project.payload->'id' then raise exception 'project identity changed'; end if;

  if p_region ? 'id' then
    select * into region from public.regions where id=(p_region->>'id')::uuid;
    if not found then raise exception 'region not found'; end if;
  else
    if coalesce(char_length(btrim(p_region->>'name_en')),0) not between 1 and 200
       or coalesce(char_length(btrim(p_region->>'name_ru')),0) not between 1 and 200
       or coalesce(char_length(p_region->>'slug'),0) not between 1 and 200 then raise exception 'invalid region'; end if;
    select * into parent_region from public.regions where id=(p_region->>'parent_id')::uuid and level='region';
    if not found then raise exception 'parent region not found'; end if;
    insert into public.regions(jurisdiction_code,parent_id,slug,level,name)
      values(parent_region.jurisdiction_code,parent_region.id,p_region->>'slug','district',
        jsonb_build_object('en',btrim(p_region->>'name_en'),'ru',btrim(p_region->>'name_ru')))
      returning * into region;
  end if;

  if p_developer ? 'id' then
    select * into developer from public.developers where id=(p_developer->>'id')::uuid;
    if not found then raise exception 'developer not found'; end if;
  else
    if coalesce(char_length(btrim(p_developer->>'name')),0) not between 2 and 200 then raise exception 'invalid developer'; end if;
    insert into public.developers(code,name_en,name_ru,jurisdiction_code)
      values('DEV'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        btrim(p_developer->>'name'),btrim(p_developer->>'name'),region.jurisdiction_code)
      returning * into developer;
  end if;

  merged := p_payload || jsonb_build_object('dev',coalesce(nullif(developer.name_en,''),developer.name_ru),
    'dt',developer.code,'zone',coalesce(region.name->>'en',''));
  update public.catalog_projects set payload=merged,developer_id=developer.id,region_id=region.id,
    jurisdiction_code=region.jurisdiction_code,updated_at=clock_timestamp(),
    data_confirmed_at=case when p_confirm then clock_timestamp() else project.data_confirmed_at end
    where id=p_project_id returning payload into merged;
  select coalesce(jsonb_agg(key order by key),'[]'::jsonb) into changed
    from jsonb_each(merged) where project.payload->key is distinct from value;
  insert into public.catalog_audit_log(entity_type,entity_id,actor_id,action,diff)
    values('project',p_project_id,null,'project_edited_by_operator',jsonb_build_object('changed',changed));
  return jsonb_build_object('developerId',developer.id,'regionId',region.id);
end $$;
revoke all on function public.admin_save_project_info(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_save_project_info(uuid,timestamptz,jsonb,jsonb,jsonb,jsonb,boolean) to service_role;
