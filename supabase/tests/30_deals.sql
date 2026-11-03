-- Deals & commissions tests (after 10_ and 20_ on the same database).
grant all on all tables in schema public to anon, authenticated, service_role;
revoke all on public.catalog_projects from anon;

create or replace function pg_temp.as_user(uid uuid, r text) returns void language plpgsql as $$
begin
  execute format('set local role %I', r);
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when uid is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (expected error): %', label;
end $$;
create or replace function pg_temp.expect_count(sql text, want bigint, label text) returns void language plpgsql as $$
declare got bigint;
begin
  execute 'select count(*) from (' || sql || ') q' into got;
  if got <> want then raise exception 'FAIL: % (want %, got %)', label, want, got; end if;
end $$;

-- fixtures -------------------------------------------------------------------
insert into auth.users(id,email) values
  ('00000000-0000-0000-0000-00000000d001','staff@x'),
  ('00000000-0000-0000-0000-00000000d101','devuser@x'),
  ('00000000-0000-0000-0000-00000000d102','brkuser@x'),
  ('00000000-0000-0000-0000-00000000d103','refuser@x'),
  ('00000000-0000-0000-0000-00000000d104','otherbrk@x');
insert into orgs(id,slug,name_en,name_ru,kind) values
  ('00000000-0000-0000-0000-00000000c001','dl-dev','Dev','Dev','developer'),
  ('00000000-0000-0000-0000-00000000c002','dl-brk','Brk','Brk','broker'),
  ('00000000-0000-0000-0000-00000000c003','dl-ref','Ref','Ref','broker'),
  ('00000000-0000-0000-0000-00000000c004','dl-other','Other','Other','broker');
update profiles set role='admin' where id='00000000-0000-0000-0000-00000000d001';
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000c001', partner_role='owner' where id='00000000-0000-0000-0000-00000000d101';
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000c002', partner_role='owner' where id='00000000-0000-0000-0000-00000000d102';
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000c003', partner_role='owner' where id='00000000-0000-0000-0000-00000000d103';
update profiles set role='partner', org_id='00000000-0000-0000-0000-00000000c004', partner_role='owner' where id='00000000-0000-0000-0000-00000000d104';
insert into catalog_projects(id,slug,org_id,payload) values ('00000000-0000-0000-0000-00000000e001','dl-p','00000000-0000-0000-0000-00000000c001','{"n":"DL"}');
insert into deals(id, project_id, developer_org_id, broker_org_id, referrer_org_id, status, contract_price, price_currency) values
  ('00000000-0000-0000-0000-00000000f001','00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c003','open',10000000,'THB'),
  ('00000000-0000-0000-0000-00000000f002','00000000-0000-0000-0000-00000000e001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002',null,'open',5000000,'THB');
insert into commission_agreements(developer_org_id, broker_org_id, terms, status, visibility) values
  ('00000000-0000-0000-0000-00000000c001', null, '{"model":"percent","percent":4}', 'active', 'parties');
insert into broker_terms(broker_org_id, platform_fee) values ('00000000-0000-0000-0000-00000000c002', '{"type":"percent","percent":20}');

create or replace function pg_temp.plan() returns jsonb language sql as $$
select jsonb_build_object(
  'totals', jsonb_build_object('currency','THB','gross',400000,'platform_fee_total',80000,'referral_total',40000,'broker_net',280000),
  'snapshot', jsonb_build_object('summary','test plan'),
  'entries', jsonb_build_array(
    jsonb_build_object('milestone','reserved','kind','commission','payer_org','00000000-0000-0000-0000-00000000c001','payee_org','00000000-0000-0000-0000-00000000c002','amount',120000,'currency','THB','delay_days',0),
    jsonb_build_object('milestone','reserved','kind','platform_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org',null,'amount',24000,'currency','THB','delay_days',0),
    jsonb_build_object('milestone','reserved','kind','referral_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org','00000000-0000-0000-0000-00000000c003','amount',12000,'currency','THB','delay_days',0),
    jsonb_build_object('milestone','contract_signed','kind','commission','payer_org','00000000-0000-0000-0000-00000000c001','payee_org','00000000-0000-0000-0000-00000000c002','amount',160000,'currency','THB','delay_days',14),
    jsonb_build_object('milestone','contract_signed','kind','platform_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org',null,'amount',32000,'currency','THB','delay_days',14),
    jsonb_build_object('milestone','contract_signed','kind','referral_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org','00000000-0000-0000-0000-00000000c003','amount',16000,'currency','THB','delay_days',14),
    jsonb_build_object('milestone','won','kind','commission','payer_org','00000000-0000-0000-0000-00000000c001','payee_org','00000000-0000-0000-0000-00000000c002','amount',120000,'currency','THB','delay_days',0),
    jsonb_build_object('milestone','won','kind','platform_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org',null,'amount',24000,'currency','THB','delay_days',0),
    jsonb_build_object('milestone','won','kind','referral_fee','payer_org','00000000-0000-0000-0000-00000000c002','payee_org','00000000-0000-0000-0000-00000000c003','amount',12000,'currency','THB','delay_days',0)
  )) $$;

-- 1. only finance actors write ---------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d101','authenticated');
  select pg_temp.expect_error($$select set_deal_plan('00000000-0000-0000-0000-00000000f001', pg_temp.plan())$$, 'developer cannot set a plan');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f001', 'reserved', '')$$, 'developer cannot advance a deal');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d102','authenticated');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f001', 'reserved', '')$$, 'broker cannot advance a deal');
rollback;

-- 2. plan, advance ---------------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d001','authenticated');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f002', 'reserved', '')$$, 'cannot advance without a plan');
  select set_deal_plan('00000000-0000-0000-0000-00000000f001', pg_temp.plan());
  select pg_temp.expect_count($$select 1 from ledger_entries where deal_id='00000000-0000-0000-0000-00000000f001' and status='expected'$$, 9, 'nine expected entries');
commit;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d001','authenticated');
  select advance_deal('00000000-0000-0000-0000-00000000f001', 'reserved', 'депозит получен');
  select pg_temp.expect_count($$select 1 from ledger_entries where deal_id='00000000-0000-0000-0000-00000000f001' and status='due'$$, 3, 'reservation releases three entries');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f001', 'reserved', '')$$, 'cannot repeat a status');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f001', 'open', '')$$, 'cannot move backwards');
commit;

-- 3. payments ---------------------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d001','authenticated');
  select pg_temp.expect_error($$select record_ledger_payment((select id from ledger_entries where milestone='contract_signed' and kind='commission' limit 1), 1000, 'x')$$, 'expected entries cannot be paid');
  select record_ledger_payment((select id from ledger_entries where milestone='reserved' and kind='commission' limit 1), 100000, 'wire-1');
  select pg_temp.expect_count($$select 1 from ledger_entries where milestone='reserved' and kind='commission' and status='due' and paid_amount=100000$$, 1, 'partial payment keeps the entry due');
  select pg_temp.expect_error($$select record_ledger_payment((select id from ledger_entries where milestone='reserved' and kind='commission' limit 1), 30000, 'wire-2')$$, 'overpayment rejected');
  select record_ledger_payment((select id from ledger_entries where milestone='reserved' and kind='commission' limit 1), 20000, 'wire-2');
  select pg_temp.expect_count($$select 1 from ledger_entries where milestone='reserved' and kind='commission' and status='paid'$$, 1, 'full payment closes the entry');
  select pg_temp.expect_error($$select set_deal_plan('00000000-0000-0000-0000-00000000f001', pg_temp.plan())$$, 're-planning is blocked after a payment');
commit;
select pg_temp.expect_error($$update ledger_entries set amount = 1 where status='paid'$$, 'paid entries are immutable');
select pg_temp.expect_error($$delete from ledger_entries where status='paid'$$, 'paid entries cannot be deleted');

-- 4. who sees what ------------------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d101','authenticated');
  select pg_temp.expect_count($$select 1 from ledger_entries$$, 3, 'developer sees only the commission entries it pays');
  select pg_temp.expect_count($$select 1 from ledger_entries where kind <> 'commission'$$, 0, 'developer never sees platform fee or referral');
  select pg_temp.expect_count($$select 1 from developer_deals_v$$, 2, 'developer sees its deals');
  select pg_temp.expect_error($$select broker_net from developer_deals_v$$, 'developer view has no broker net');
  select pg_temp.expect_count($$select 1 from deals$$, 0, 'developer cannot read the raw deals table');
  select pg_temp.expect_count($$select 1 from broker_terms$$, 0, 'developer cannot read broker terms');
  select pg_temp.expect_count($$select 1 from commission_agreements$$, 1, 'developer reads its own agreement');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d102','authenticated');
  select pg_temp.expect_count($$select 1 from ledger_entries$$, 9, 'broker sees commission, platform fee and referral entries');
  select pg_temp.expect_count($$select 1 from broker_deals_v where broker_net = 280000$$, 1, 'broker sees its net');
  select pg_temp.expect_count($$select 1 from broker_terms$$, 1, 'broker reads its own terms');
  select pg_temp.expect_count($$select 1 from commission_agreements$$, 0, 'private agreement not visible to a broker');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d103','authenticated');
  select pg_temp.expect_count($$select 1 from ledger_entries$$, 3, 'referrer sees only referral entries');
  select pg_temp.expect_count($$select 1 from ledger_entries where kind='referral_fee'$$, 3, 'referral entries');
rollback;
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d104','authenticated');
  select pg_temp.expect_count($$select 1 from ledger_entries$$, 0, 'unrelated broker sees nothing');
  select pg_temp.expect_count($$select 1 from broker_deals_v$$, 0, 'unrelated broker sees no deals');
rollback;
begin;
  select pg_temp.as_user(null,'anon');
  select pg_temp.expect_count($$select 1 from ledger_entries$$, 0, 'anon sees no ledger');
  select pg_temp.expect_count($$select 1 from broker_deals_v$$, 0, 'anon sees no deals');
rollback;
update commission_agreements set visibility='public_to_brokers';
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d104','authenticated');
  select pg_temp.expect_count($$select 1 from commission_agreements$$, 1, 'public-to-brokers agreement is visible to any broker');
rollback;

-- 5. completion and cancellation ---------------------------------------------------------------
begin;
  select pg_temp.as_user('00000000-0000-0000-0000-00000000d001','authenticated');
  select pg_temp.expect_error($$select add_ledger_adjustment('00000000-0000-0000-0000-00000000f001','adjustment','00000000-0000-0000-0000-00000000c002',null,500,'THB','x')$$, 'adjustment needs a note');
  select add_ledger_adjustment('00000000-0000-0000-0000-00000000f001','clawback','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c001',1000,'THB','возврат по соглашению');
  select pg_temp.expect_count($$select 1 from ledger_entries where kind='clawback' and status='due'$$, 1, 'clawback entry created');
  select advance_deal('00000000-0000-0000-0000-00000000f001', 'cancelled', 'покупатель отказался');
  select pg_temp.expect_count($$select 1 from ledger_entries where deal_id='00000000-0000-0000-0000-00000000f001' and status='void'$$, 8, 'unpaid entries are voided on cancellation');
  select pg_temp.expect_count($$select 1 from deals where id='00000000-0000-0000-0000-00000000f001' and clawback_review$$, 1, 'paid money flags a clawback review');
  select pg_temp.expect_error($$select advance_deal('00000000-0000-0000-0000-00000000f001', 'won', '')$$, 'closed deals cannot move');
commit;

-- 6. full happy path on the second deal ----------------------------------------------------------
select set_deal_plan('00000000-0000-0000-0000-00000000f002', pg_temp.plan());
select advance_deal('00000000-0000-0000-0000-00000000f002', 'won', 'сразу завершена');
select pg_temp.expect_count($$select 1 from ledger_entries where deal_id='00000000-0000-0000-0000-00000000f002' and status='due'$$, 9, 'skipping to won releases every milestone');
select pg_temp.expect_count($$select 1 from deals where id='00000000-0000-0000-0000-00000000f002' and reserved_at is not null and contract_signed_at is not null and completed_at is not null$$, 1, 'skipped milestones are timestamped');
select pg_temp.expect_count($$select 1 from deal_events where deal_id='00000000-0000-0000-0000-00000000f002'$$, 2, 'events are logged');

select 'DEALS OK' as result;
