-- Run after the existing suites; model API privileges rather than blanket table access.
revoke all on public.catalog_projects from anon;
create or replace function pg_temp.evidence_expect_error(q text) returns void language plpgsql as $$
begin
 begin execute q; exception when others then return; end;
 raise exception 'expected access failure: %',q;
end $$;
revoke all on public.project_evidence from anon,authenticated;
grant select(id,project_id,kind,fact_key,title,source_url,observed_at,details,status,reviewed_at) on public.project_evidence to anon,authenticated;
grant insert,update on public.project_evidence to authenticated;
begin;
insert into public.project_evidence(id,project_id,kind,fact_key,title,source_url,observed_at,details)
 values ('00000000-0000-4000-8000-00000000ee01','00000000-0000-0000-0000-0000000000d1','operating_cost','cam','CAM','https://example.org/source',current_date,'{"amount":80,"currency":"THB","basis":"sqm","period":"month"}');
set local role anon;
select pg_temp.evidence_expect_error($$select * from public.catalog_projects$$);
select pg_temp.evidence_expect_error($$select submitted_by from public.project_evidence$$);
do $$begin if exists(select 1 from public.project_evidence) then raise exception 'pending evidence leaked';end if;end$$;
select pg_temp.evidence_expect_error($$select public.review_project_evidence('00000000-0000-4000-8000-00000000ee01',true)$$);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
select set_config('request.jwt.claim.role','authenticated',true);
insert into public.project_evidence(project_id,kind,fact_key,title,source_url,observed_at,details,submitted_by)
 values ('00000000-0000-0000-0000-0000000000d1','amenity','pool','Pool','https://example.org/source',current_date,'{"description":"25m pool"}','00000000-0000-0000-0000-0000000000b1');
select pg_temp.evidence_expect_error($$insert into public.project_evidence(project_id,kind,fact_key,title,source_url,observed_at,details,status,reviewed_at,submitted_by) values ('00000000-0000-0000-0000-0000000000d1','amenity','forged','Fake','https://example.org/source',current_date,'{}','published',now(),'00000000-0000-0000-0000-0000000000b1')$$);
select pg_temp.evidence_expect_error($$select public.review_project_evidence('00000000-0000-4000-8000-00000000ee01',true)$$);
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
select public.review_project_evidence('00000000-0000-4000-8000-00000000ee01',true);
reset role;
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $$begin if (select count(*) from public.project_evidence)<>1 then raise exception 'public evidence contract failed';end if;end$$;
select count(*) from public.public_project_inventory;
reset role;
update public.catalog_projects set is_published=false where id='00000000-0000-0000-0000-0000000000d1';
set local role anon;
do $$begin if exists(select 1 from public.project_evidence) then raise exception 'unpublished project facts leaked';end if;end$$;
reset role;
rollback;
select 'PROJECT EVIDENCE OK' as result;

-- New developer projects receive their public ID only after approval; supplied IDs never win.
begin;
insert into catalog_projects(id,slug,payload,draft_payload) values
 ('00000000-0000-4000-8000-00000000ef01','new-id-test','{"id":999999,"n":"New"}','{"id":999999,"n":"New"}');
insert into moderation_submissions(id,entity_type,entity_id,snapshot,status) values
 ('00000000-0000-4000-8000-00000000ef02','project','00000000-0000-4000-8000-00000000ef01','{"id":999999,"n":"New"}','pending');
select moderation_approve('00000000-0000-4000-8000-00000000ef02');
do $$begin if not exists(select 1 from catalog_projects where id='00000000-0000-4000-8000-00000000ef01' and legacy_id is not null and legacy_id<>999999 and (payload->>'id')::integer=legacy_id) then raise exception 'public identity allocation failed';end if;end $$;
rollback;
