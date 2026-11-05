-- Atomic directory editing. The application authenticates the operator before using service_role.
-- Never modifies project ownership, partner membership, or publication state.
alter table public.developers add column if not exists admin_revision integer not null default 1;

create or replace function public.admin_save_developer_directory(
  p_id uuid, p_expected_revision integer, p_code text, p_name_en text, p_name_ru text, p_website text, p_org_id uuid
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  d public.developers%rowtype;
  result_id uuid;
  result_revision integer;
begin
  if current_user not in ('service_role','postgres') then raise exception 'admin only'; end if;
  if p_name_en is null or char_length(trim(p_name_en)) not between 2 and 200
     or p_name_ru is null or char_length(trim(p_name_ru)) not between 2 and 200 then raise exception 'invalid name'; end if;
  if p_website is not null and (char_length(p_website)>500 or p_website !~ '^https://[^[:space:]@]+$') then raise exception 'invalid website'; end if;
  if p_org_id is not null and not exists(select 1 from public.orgs where id=p_org_id and kind='developer') then raise exception 'invalid organization'; end if;
  if p_id is null then
    if p_expected_revision is distinct from 0 or p_code is null or p_code !~ '^DEV[A-F0-9]{12}$' then raise exception 'invalid create request'; end if;
    insert into public.developers(code,name_en,name_ru,website,org_id)
      values(p_code,trim(p_name_en),trim(p_name_ru),p_website,p_org_id) returning id,admin_revision into result_id,result_revision;
  else
    select * into d from public.developers where id=p_id for update;
    if not found then raise exception 'developer not found'; end if;
    if p_expected_revision is distinct from d.admin_revision then raise exception 'revision conflict'; end if;
    update public.developers set name_en=trim(p_name_en),name_ru=trim(p_name_ru),website=p_website,org_id=p_org_id,admin_revision=admin_revision+1
      where id=p_id returning id,admin_revision into result_id,result_revision;
    -- Synchronize only records explicitly linked by FK, not guessed text/code matches.
    -- Preserve project ownership, publication flags, all other facts, and existing draft edits.
    update public.catalog_projects set
      payload=jsonb_set(payload,'{dev}',to_jsonb(trim(p_name_en))),
      draft_payload=case when draft_payload is null then null else jsonb_set(draft_payload,'{dev}',to_jsonb(trim(p_name_en))) end,
      updated_at=now()
      where developer_id=p_id and (payload->>'dev' is distinct from trim(p_name_en)
        or (draft_payload is not null and draft_payload->>'dev' is distinct from trim(p_name_en)));
  end if;
  return jsonb_build_object('id',result_id,'revision',result_revision);
end $$;
revoke all on function public.admin_save_developer_directory(uuid,integer,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_save_developer_directory(uuid,integer,text,text,text,text,uuid) to service_role;
