-- Deals & commissions: configurable agreements (developer → broker), broker terms (broker ↔ platform),
-- deal plan snapshot, milestone ledger, payments, protected state transitions, party-scoped visibility.

-- ---------------------------------------------------------------------------
-- Configurable terms
-- ---------------------------------------------------------------------------
create table if not exists public.commission_agreements (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  developer_org_id uuid not null references public.orgs (id) on delete cascade,
  broker_org_id uuid references public.orgs (id) on delete cascade,      -- null = any broker
  project_id uuid references public.catalog_projects (id) on delete cascade, -- null = all projects of the developer
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),            -- validated by lib/commission/terms.ts
  exclusive boolean not null default false,                               -- leads of the project are routed to this broker
  visibility text not null default 'parties' check (visibility in ('parties', 'public_to_brokers')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  valid_from date not null default current_date,
  valid_to date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists commission_agreements_dev_idx on public.commission_agreements (developer_org_id, status);

create table if not exists public.broker_terms (
  id uuid primary key default gen_random_uuid(),
  broker_org_id uuid not null references public.orgs (id) on delete cascade,
  developer_org_id uuid references public.orgs (id) on delete cascade,    -- null = default for all developers
  platform_fee jsonb not null default '{"type":"none"}'::jsonb,           -- validated by platformFeeSchema
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  valid_from date not null default current_date,
  valid_to date,
  note text not null default '',
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create index if not exists broker_terms_broker_idx on public.broker_terms (broker_org_id, status);

-- ---------------------------------------------------------------------------
-- Deals (extend the existing table)
-- ---------------------------------------------------------------------------
alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals
  add constraint deals_status_check check (status in ('open', 'reserved', 'contract_signed', 'won', 'lost', 'cancelled'));

alter table public.deals
  add column if not exists developer_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists broker_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists referrer_org_id uuid references public.orgs (id) on delete set null,
  add column if not exists referral_percent numeric check (referral_percent is null or referral_percent between 0 and 100),
  add column if not exists agreement_id uuid references public.commission_agreements (id) on delete set null,
  add column if not exists broker_terms_id uuid references public.broker_terms (id) on delete set null,
  add column if not exists contract_price numeric check (contract_price is null or contract_price >= 0),
  add column if not exists net_price numeric check (net_price is null or net_price >= 0),
  add column if not exists price_currency text check (price_currency is null or price_currency ~ '^[A-Z]{3}$'),
  add column if not exists fx_rate numeric check (fx_rate is null or fx_rate > 0),
  add column if not exists commission_currency text check (commission_currency is null or commission_currency ~ '^[A-Z]{3}$'),
  add column if not exists commission_gross numeric,
  add column if not exists platform_fee_total numeric,
  add column if not exists referral_fee_total numeric,
  add column if not exists broker_net numeric,
  add column if not exists plan_snapshot jsonb,        -- terms used at the time of planning (immutable audit)
  add column if not exists reserved_at timestamptz,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists lost_reason text not null default '',
  add column if not exists clawback_review boolean not null default false;

create index if not exists deals_developer_idx on public.deals (developer_org_id);
create index if not exists deals_broker_idx on public.deals (broker_org_id);

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  milestone text check (milestone in ('reserved', 'contract_signed', 'won')),   -- null for adjustments
  kind text not null check (kind in ('commission', 'platform_fee', 'referral_fee', 'payout', 'adjustment', 'clawback')),
  payer_org uuid references public.orgs (id) on delete set null,                 -- null = platform operator
  payee_org uuid references public.orgs (id) on delete set null,                 -- null = platform operator
  amount numeric not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  delay_days int not null default 0,
  status text not null default 'expected' check (status in ('expected', 'due', 'paid', 'void')),
  due_at timestamptz,
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  paid_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ledger_entries_deal_idx on public.ledger_entries (deal_id);
create index if not exists ledger_entries_payer_idx on public.ledger_entries (payer_org);
create index if not exists ledger_entries_payee_idx on public.ledger_entries (payee_org);

create table if not exists public.ledger_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  amount numeric not null check (amount > 0),
  reference text not null default '',
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  note text not null default '',
  actor uuid references auth.users (id) on delete set null,   -- null for the shared admin login / service role
  created_at timestamptz not null default now()
);
create index if not exists deal_events_deal_idx on public.deal_events (deal_id, created_at);

-- Paid money is never rewritten or deleted
create or replace function public.ledger_entries_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.paid_amount > 0 then raise exception 'ledger entries with payments cannot be deleted'; end if;
    return old;
  end if;
  if old.paid_amount > 0 and (
       new.amount is distinct from old.amount or new.currency is distinct from old.currency
       or new.payer_org is distinct from old.payer_org or new.payee_org is distinct from old.payee_org
       or new.kind is distinct from old.kind or new.milestone is distinct from old.milestone or new.deal_id is distinct from old.deal_id) then
    raise exception 'ledger entries with payments are immutable';
  end if;
  if new.paid_amount < old.paid_amount then raise exception 'paid amount cannot decrease'; end if;
  return new;
end $$;
drop trigger if exists ledger_entries_guard on public.ledger_entries;
create trigger ledger_entries_guard before update or delete on public.ledger_entries
  for each row execute function public.ledger_entries_guard();

-- ---------------------------------------------------------------------------
-- Functions (finance actor = platform staff or trusted server code with the service role)
-- ---------------------------------------------------------------------------
create or replace function public.finance_actor()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.is_staff();
$$;
revoke all on function public.finance_actor() from public;
grant execute on function public.finance_actor() to anon, authenticated, service_role;

create or replace function public.deal_rank(p_status text)
returns int language sql immutable as $$
  select case p_status when 'open' then 0 when 'reserved' then 1 when 'contract_signed' then 2 when 'won' then 3
                       when 'lost' then -1 when 'cancelled' then -1 else null end;
$$;

-- Store the computed plan: totals, snapshot and the ledger. Allowed until money has been paid.
create or replace function public.set_deal_plan(p_deal uuid, p_plan jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare d record; e jsonb; r int; ts timestamptz;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.id is null then raise exception 'deal not found'; end if;
  if d.status in ('lost', 'cancelled', 'won') then raise exception 'deal is closed'; end if;
  if exists (select 1 from public.ledger_entries l where l.deal_id = p_deal and l.paid_amount > 0) then
    raise exception 'payments already recorded: use adjustments instead of re-planning';
  end if;

  delete from public.ledger_entries where deal_id = p_deal and status in ('expected', 'due') and kind not in ('adjustment', 'clawback');

  update public.deals set
    commission_currency = p_plan #>> '{totals,currency}',
    commission_gross = (p_plan #>> '{totals,gross}')::numeric,
    platform_fee_total = (p_plan #>> '{totals,platform_fee_total}')::numeric,
    referral_fee_total = (p_plan #>> '{totals,referral_total}')::numeric,
    broker_net = (p_plan #>> '{totals,broker_net}')::numeric,
    plan_snapshot = p_plan -> 'snapshot',
    commission_amount_thb = case when p_plan #>> '{totals,currency}' = 'THB' then (p_plan #>> '{totals,gross}')::numeric else commission_amount_thb end,
    updated_at = now()
  where id = p_deal;

  r := public.deal_rank(d.status);
  for e in select * from jsonb_array_elements(coalesce(p_plan -> 'entries', '[]'::jsonb)) loop
    ts := case e ->> 'milestone'
            when 'reserved' then d.reserved_at when 'contract_signed' then d.contract_signed_at else d.completed_at end;
    insert into public.ledger_entries (deal_id, milestone, kind, payer_org, payee_org, amount, currency, delay_days, status, due_at)
    values (
      p_deal, e ->> 'milestone', e ->> 'kind',
      nullif(e ->> 'payer_org', '')::uuid, nullif(e ->> 'payee_org', '')::uuid,
      (e ->> 'amount')::numeric, e ->> 'currency', coalesce((e ->> 'delay_days')::int, 0),
      case when r >= public.deal_rank(e ->> 'milestone') then 'due' else 'expected' end,
      case when r >= public.deal_rank(e ->> 'milestone')
           then coalesce(ts, now()) + make_interval(days => coalesce((e ->> 'delay_days')::int, 0)) else null end
    );
  end loop;

  insert into public.deal_events (deal_id, event, note, actor) values (p_deal, 'plan_set', coalesce(p_plan #>> '{snapshot,summary}', ''), auth.uid());
end $$;

create or replace function public.advance_deal(p_deal uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare d record; nr int; paid boolean;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from public.deals where id = p_deal for update;
  if d.id is null then raise exception 'deal not found'; end if;
  if d.status in ('lost', 'cancelled', 'won') then raise exception 'deal is already closed'; end if;

  if p_status in ('reserved', 'contract_signed', 'won') then
    nr := public.deal_rank(p_status);
    if nr <= public.deal_rank(d.status) then raise exception 'a deal cannot move backwards or repeat a status'; end if;
    if d.commission_gross is null then raise exception 'plan the commission before moving the deal forward'; end if;
    update public.deals set
      status = p_status,
      reserved_at = case when nr >= 1 then coalesce(reserved_at, now()) else reserved_at end,
      contract_signed_at = case when nr >= 2 then coalesce(contract_signed_at, now()) else contract_signed_at end,
      completed_at = case when nr >= 3 then coalesce(completed_at, now()) else completed_at end,
      updated_at = now()
    where id = p_deal;
    update public.ledger_entries set status = 'due', due_at = now() + make_interval(days => delay_days)
     where deal_id = p_deal and status = 'expected' and milestone is not null and public.deal_rank(milestone) <= nr;
  elsif p_status in ('lost', 'cancelled') then
    select exists (select 1 from public.ledger_entries where deal_id = p_deal and paid_amount > 0) into paid;
    -- only planned entries are voided; manual adjustments / clawbacks must survive the cancellation
    update public.ledger_entries set status = 'void'
     where deal_id = p_deal and status in ('expected', 'due') and paid_amount = 0 and kind not in ('adjustment', 'clawback');
    update public.deals set status = p_status, lost_reason = left(coalesce(p_note, ''), 1000), clawback_review = paid, updated_at = now() where id = p_deal;
  else
    raise exception 'unknown status';
  end if;

  insert into public.deal_events (deal_id, event, from_status, to_status, note, actor)
  values (p_deal, 'status', d.status, p_status, left(coalesce(p_note, ''), 1000), auth.uid());
end $$;

create or replace function public.record_ledger_payment(p_entry uuid, p_amount numeric, p_ref text, p_paid_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare e record; total numeric;
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into e from public.ledger_entries where id = p_entry for update;
  if e.id is null then raise exception 'entry not found'; end if;
  if e.status <> 'due' then raise exception 'only due entries can be paid (status: %)', e.status; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  total := e.paid_amount + p_amount;
  if total > e.amount then raise exception 'payment exceeds the amount due'; end if;
  insert into public.ledger_payments (entry_id, amount, reference, paid_at, recorded_by) values (p_entry, p_amount, coalesce(p_ref, ''), coalesce(p_paid_at, now()), auth.uid());
  update public.ledger_entries set paid_amount = total, status = case when total = amount then 'paid' else status end,
         paid_at = case when total = amount then coalesce(p_paid_at, now()) else paid_at end
   where id = p_entry;
  insert into public.deal_events (deal_id, event, note, actor)
  values (e.deal_id, 'payment', format('%s %s %s', p_amount, e.currency, coalesce(p_ref, '')), auth.uid());
end $$;

-- Manual adjustment / clawback (never edits existing entries)
create or replace function public.add_ledger_adjustment(p_deal uuid, p_kind text, p_payer uuid, p_payee uuid, p_amount numeric, p_currency text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.finance_actor() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('adjustment', 'clawback') then raise exception 'bad kind'; end if;
  if length(coalesce(p_note, '')) < 5 then raise exception 'a note is required'; end if;
  insert into public.ledger_entries (deal_id, kind, payer_org, payee_org, amount, currency, status, due_at, note)
  values (p_deal, p_kind, p_payer, p_payee, p_amount, p_currency, 'due', now(), p_note);
  insert into public.deal_events (deal_id, event, note, actor) values (p_deal, p_kind, p_note, auth.uid());
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'set_deal_plan(uuid, jsonb)', 'advance_deal(uuid, text, text)',
    'record_ledger_payment(uuid, numeric, text, timestamptz)',
    'add_ledger_adjustment(uuid, text, uuid, uuid, numeric, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS and party-scoped views
-- ---------------------------------------------------------------------------
alter table public.commission_agreements enable row level security;
alter table public.broker_terms enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_payments enable row level security;
alter table public.deal_events enable row level security;

create policy "agreements_staff" on public.commission_agreements for all using (public.is_staff()) with check (public.is_staff());
create policy "agreements_parties_read" on public.commission_agreements for select using (
  status = 'active' and (
    public.partner_of_org(developer_org_id)
    or (broker_org_id is not null and public.partner_of_org(broker_org_id))
    or (visibility = 'public_to_brokers' and exists (
          select 1 from public.profiles pr join public.orgs o on o.id = pr.org_id
          where pr.id = auth.uid() and pr.role = 'partner' and o.kind = 'broker'))
  )
);

create policy "broker_terms_staff" on public.broker_terms for all using (public.is_staff()) with check (public.is_staff());
create policy "broker_terms_own_read" on public.broker_terms for select using (public.partner_of_org(broker_org_id));

create policy "ledger_staff" on public.ledger_entries for all using (public.is_staff()) with check (public.is_staff());
create policy "ledger_parties_read" on public.ledger_entries for select using (
  (payer_org is not null and public.partner_of_org(payer_org)) or (payee_org is not null and public.partner_of_org(payee_org))
);
create policy "ledger_payments_staff" on public.ledger_payments for select using (public.is_staff());
create policy "deal_events_staff" on public.deal_events for select using (public.is_staff());

-- A developer sees what it pays; a broker sees its own share. Neither sees the other side's terms.
create or replace view public.developer_deals_v as
select d.id, d.project_id, d.status, d.contract_price, d.price_currency,
       d.commission_gross, d.commission_currency, d.created_at, d.reserved_at, d.contract_signed_at, d.completed_at
from public.deals d
where d.developer_org_id is not null and public.partner_of_org(d.developer_org_id);

create or replace view public.broker_deals_v as
select d.id, d.project_id, d.status, d.contract_price, d.price_currency,
       d.commission_gross, d.platform_fee_total, d.referral_fee_total, d.broker_net, d.commission_currency,
       d.created_at, d.reserved_at, d.contract_signed_at, d.completed_at
from public.deals d
where d.broker_org_id is not null and public.partner_of_org(d.broker_org_id);

grant select on public.developer_deals_v, public.broker_deals_v to authenticated;
grant select on public.commission_agreements, public.broker_terms, public.ledger_entries to authenticated;
