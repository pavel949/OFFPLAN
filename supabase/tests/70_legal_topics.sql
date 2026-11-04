-- Country legal modules: public read of published topics only, no anonymous writes, "verified" needs a named reviewer.
create or replace function pg_temp.lt_expect_error(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;
-- earlier suites re-grant everything; restore the state the migration leaves behind
revoke insert, update, delete, truncate, references, trigger on public.legal_topics from anon;
begin;
insert into public.legal_topics(jurisdiction_code, topic, title_ru, status, is_published)
 values ('VN', 'hidden_test', 'hidden', 'draft', false);
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
set local role anon;
do $$begin
  if not exists(select 1 from public.legal_topics where jurisdiction_code='TH' and topic='ownership') then raise exception 'anon cannot read published topic'; end if;
  if exists(select 1 from public.legal_topics where topic='hidden_test') then raise exception 'anon sees unpublished topic'; end if;
end$$;
select pg_temp.lt_expect_error($$update public.legal_topics set status='verified'$$, 'anon updated topics');
select pg_temp.lt_expect_error($$insert into public.legal_topics(jurisdiction_code,topic,title_ru) values ('TH','x_test','x')$$, 'anon inserted topic');
select pg_temp.lt_expect_error($$delete from public.legal_topics$$, 'anon deleted topics');
reset role;
select pg_temp.lt_expect_error($$update public.legal_topics set status='verified' where jurisdiction_code='TH' and topic='ownership'$$, 'verified without reviewer accepted');
update public.legal_topics set status='verified', reviewed_by='Test Lawyer', reviewed_at=current_date, valid_until=current_date+365 where jurisdiction_code='TH' and topic='ownership';
do $$begin
  if (select count(*) from public.regions where jurisdiction_code='TH' and parent_id is not null and slug in ('sukhumvit','jomtien','hua-hin-town'))<>3 then raise exception 'Thai destinations missing'; end if;
  if (select count(*) from public.regions where jurisdiction_code='VN' and level='region')<5 then raise exception 'Vietnam regions missing'; end if;
end$$;
rollback;
select 'LEGAL TOPICS OK' as result;
