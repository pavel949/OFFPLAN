begin;
create function pg_temp.assert_true(actual boolean, label text) returns void language plpgsql as $$
begin
  if actual is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

create function pg_temp.expect_42501(command text, label text) returns void language plpgsql as $$
begin
  begin execute command; exception when insufficient_privilege then return; end;
  raise exception 'FAIL (expected permission denied): %', label;
end $$;

insert into auth.users(id, email, email_confirmed_at)
values ('00000000-0000-0000-0000-00000000f600', 'pavel@ignatevestate.com', now());
insert into platform_owners(user_id, email)
values ('00000000-0000-0000-0000-00000000f600', 'pavel@ignatevestate.com');

-- Use the exact database role the browser uses, including a deliberately misleading email claim.
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"pavel@ignatevestate.com"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f001', true);
select pg_temp.assert_true(not is_platform_owner(), 'email claim cannot grant owner access');
select pg_temp.expect_42501('select email from public.platform_owners', 'owner list remains private');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f600', true);
select pg_temp.assert_true(is_platform_owner(), 'confirmed assigned UUID is recognised');
select pg_temp.expect_42501($cmd$select cv_owner_publish(null, null, null, null)$cmd$, 'owner session cannot call service RPC directly');
select pg_temp.expect_42501($cmd$select claim_verification_case('00000000-0000-0000-0000-00000000fc01')$cmd$, 'owner privilege does not grant project review');
select pg_temp.expect_42501($cmd$select decide_verification('00000000-0000-0000-0000-00000000fc01', 'approved', 'A sufficiently detailed project decision')$cmd$, 'owner privilege does not grant project decisions');
reset role;

select pg_temp.assert_true(not has_function_privilege('anon', 'public.cv_owner_publish(uuid,uuid,jsonb,text)', 'execute'), 'anon does not have publication EXECUTE');
select pg_temp.assert_true(not has_function_privilege('service_role', 'public.cv_publish_internal(uuid,text,uuid)', 'execute'), 'service role cannot skip owner and reviewer checks');
select pg_temp.assert_true(not has_table_privilege('service_role', 'public.cv_methodology_versions', 'truncate'), 'service role cannot truncate history');
select pg_temp.assert_true(not has_column_privilege('service_role', 'public.cv_methodology_versions', 'status', 'update'), 'service role cannot bypass transitions');
select pg_temp.assert_true(not has_column_privilege('service_role', 'public.cv_methodology_approvals', 'decision', 'update'), 'service role cannot rewrite decisions');

insert into cv_methodology_versions (id, jurisdiction_code, version, title, config)
values ('00000000-0000-0000-0000-0000000d0001', 'TH', '8.8.1', 'draft', '{"version":"8.8.1","title":"Before"}'),
       ('00000000-0000-0000-0000-0000000d0002', 'TH', '8.8.2', 'draft', '{"version":"8.8.2","title":"Second"}');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.expect_42501(
  $cmd$select cv_owner_publish('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-00000000f001', '{"version":"8.8.1","title":"After"}', 'A sufficiently long summary')$cmd$,
  'service role cannot nominate an ordinary account');
do $$
begin
  begin
    perform cv_owner_publish('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-00000000f600', '{"version":"8.8.1","title":"After"}', 'A sufficiently long summary');
    raise exception 'FAIL: owner publication enabled by default';
  exception when raise_exception then
    if sqlerrm <> 'owner sole approval is switched off' then raise; end if;
  end;
end $$;
select pg_temp.assert_true(
  (select status = 'draft' and config->>'title' = 'Before' from cv_methodology_versions where version = '8.8.1'),
  'rejected publication did not modify the draft');
reset role;
update platform_owners set sole_approval_enabled = true;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select cv_owner_publish('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-00000000f600',
  '{"version":"8.8.1","title":"After"}', 'Owner publishes this method version');
select pg_temp.assert_true(
  (select status = 'published' and approval_mode = 'owner' and published_by_owner = '00000000-0000-0000-0000-00000000f600'
     and config->>'title' = 'After' and config_hash = encode(sha256(convert_to(config::text, 'utf8')), 'hex')
   from cv_methodology_versions where version = '8.8.1'), 'exact configuration, actor and hash are recorded');
select cv_submit_for_review('00000000-0000-0000-0000-0000000d0002', 'Submit the second test version for review',
  '{"version":"8.8.2","title":"Reviewed"}');
do $$
begin
  begin
    perform cv_owner_publish('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-00000000f600',
      '{"version":"8.8.2","title":"Modified"}', 'A sufficiently detailed change');
    raise exception 'FAIL: different configuration was published';
  exception when raise_exception then
    if sqlerrm <> 'configuration changed since the version was opened' then raise; end if;
  end;
end $$;
reset role;

set local role anon;
select pg_temp.assert_true(
  (select approval_mode = 'owner' from cv_methodology_versions where version = '8.8.1'), 'approval mode is public');
select pg_temp.expect_42501('select config from cv_methodology_versions', 'configuration remains private');
select pg_temp.expect_42501('select published_by_owner from cv_methodology_versions', 'owner identity remains private');
reset role;

do $$
begin
  begin
    update cv_methodology_versions set status = 'retired', change_summary = 'changed history' where version = '8.8.1';
    raise exception 'FAIL: metadata changed during retirement';
  exception when raise_exception then
    if sqlerrm <> 'a published methodology version is immutable' then raise; end if;
  end;
end $$;

-- Verify project separation with owner mode on even if the owner also has a reviewer profile.
select set_config('request.jwt.claim.sub', '', true);
update profiles set role = 'reviewer' where id = '00000000-0000-0000-0000-00000000f600';
insert into verification_cases(id, project_id, org_id, target_level, template_id, status, assigned_reviewer)
select '00000000-0000-0000-0000-0000000d0010', project_id, org_id, target_level, template_id, 'in_review',
  '00000000-0000-0000-0000-00000000f600' from verification_cases where status = 'approved' limit 1;
insert into verification_items(case_id, item_key, required, status, verified_by)
select '00000000-0000-0000-0000-0000000d0010', item_key, required, status, '00000000-0000-0000-0000-00000000f600'
from verification_items where case_id = (select id from verification_cases where status = 'approved' limit 1);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f600', true);
select pg_temp.expect_42501(
  $cmd$select decide_verification('00000000-0000-0000-0000-0000000d0010', 'approved', 'The owner reviewed the required items')$cmd$,
  'owner who reviewed the project cannot make its final decision');
select pg_temp.expect_42501(
  $cmd$select cv_review_version('00000000-0000-0000-0000-0000000d0002', 'approve', '')$cmd$,
  'owner cannot also count as an independent methodology analyst');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f101', true);
select decide_verification('00000000-0000-0000-0000-0000000d0010', 'approved', 'An independent second reviewer made the decision');
reset role;
select pg_temp.assert_true(
  (select status = 'approved' and assigned_reviewer <> decided_by from verification_cases where id = '00000000-0000-0000-0000-0000000d0010'),
  'final project approval has a distinct reviewer');
rollback;
select 'CV OWNER OK' as result;
