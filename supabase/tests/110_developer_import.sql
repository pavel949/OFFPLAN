begin;
do $$
begin
  if has_table_privilege('anon','public.developer_import_records','select') or has_table_privilege('authenticated','public.developer_import_projects','select') then
    raise exception 'Import data must stay private';
  end if;
  if not has_table_privilege('service_role','public.developer_import_records','insert') then
    raise exception 'Service import unavailable';
  end if;
end $$;
insert into public.developer_import_projects(external_id,developer_code,name,source_url,source_data) values('IE-999','DEV-SANSIRI','Test','https://example.com','{}');
insert into public.developer_import_records(dataset,source_row,external_project_id,source_key,data) values
('offers',2,'IE-999','same-unit-freehold','{"unit_id":"unit1","ownership":"freehold","status":"unknown"}'),
('offers',3,'IE-999','same-unit-leasehold','{"unit_id":"unit1","ownership":"leasehold","status":"unknown"}');
do $$ begin
 if (select count(*) from public.developer_import_records where external_project_id='IE-999')<>2 then raise exception 'Offer variants lost'; end if;
end $$;
rollback;
select 'Developer import: OK';
