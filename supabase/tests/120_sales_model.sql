begin;
do $$ begin
  if has_table_privilege('anon','public.project_sales_models','select')
     or has_table_privilege('authenticated','public.project_sales_models','select')
     or has_table_privilege('service_role','public.project_sales_models','update')
     or has_table_privilege('service_role','public.project_sales_models','delete') then
    raise exception 'Sales models must be private and append-only';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.project_sales_models'::regclass) then raise exception 'RLS required'; end if;
end $$;
insert into public.catalog_projects(id,slug,payload,is_published,moderation_status) values
 ('00000000-0000-4000-8000-000000120001','test-sales-model-1','{}',false,'draft'),
 ('00000000-0000-4000-8000-000000120002','test-sales-model-2','{}',false,'draft');
insert into public.project_units(id,project_id,label) values
 ('00000000-0000-4000-8000-000000120003','00000000-0000-4000-8000-000000120001','A-101');
set local role service_role;
insert into public.project_sales_models(project_id,revision,model) values
 ('00000000-0000-4000-8000-000000120001',1,'{"version":1,"units":[{"id":"00000000-0000-4000-8000-000000120003"}]}');
do $$ begin
  begin
    insert into public.project_sales_models(project_id,revision,model) values ('00000000-0000-4000-8000-000000120001',1,'{"version":1,"units":[]}');
    raise exception 'FAIL: stale revision accepted';
  exception when others then if sqlerrm not like '%revision conflict%' then raise; end if; end;
  begin
    insert into public.project_sales_models(project_id,revision,model) values ('00000000-0000-4000-8000-000000120002',1,'{"version":1,"units":[{"id":"00000000-0000-4000-8000-000000120003"}]}');
    raise exception 'FAIL: cross-project unit accepted';
  exception when others then if sqlerrm not like '%unit project mismatch%' then raise; end if; end;
end $$;
insert into public.project_sales_models(project_id,revision,model) values
 ('00000000-0000-4000-8000-000000120001',2,'{"version":1,"units":[]}');
reset role;
do $$ begin
  if (select count(*) from public.project_sales_models where project_id='00000000-0000-4000-8000-000000120001')<>2 then raise exception 'History lost'; end if;
end $$;
rollback;
select 'Sales model privacy, unit identity and revision checks: OK';
