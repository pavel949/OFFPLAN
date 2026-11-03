-- Developer portal: partners must be able to READ the units of their own projects (draft or
-- published) — UPDATE/DELETE by id also needs a SELECT policy to see the rows.

drop policy if exists "project_units_partner_read" on public.project_units;
create policy "project_units_partner_read" on public.project_units
  for select using (
    exists (
      select 1
      from public.catalog_projects cp
      join public.profiles pr on pr.org_id = cp.org_id
      where cp.id = project_units.project_id
        and pr.id = auth.uid()
        and pr.role = 'partner'
    )
  );

-- Billing groundwork: active (not sold) units per organisation. security_invoker => RLS applies,
-- so partners see only their own organisation and staff see all.
create or replace view public.org_active_units with (security_invoker = true) as
select
  cp.org_id,
  count(*) filter (where u.status <> 'sold') as active_units,
  count(*) filter (where u.status <> 'sold' and u.price_updated_at < now() - interval '30 days') as expired_units,
  max(u.price_updated_at) as last_price_update
from public.project_units u
join public.catalog_projects cp on cp.id = u.project_id
group by cp.org_id;

grant select on public.org_active_units to authenticated;

-- ---------------------------------------------------------------------------
-- "Prices are still valid" confirmation: refreshes price_updated_at of all active units of a
-- project without changing data. Allowed for staff, for partners of the owning org, and for
-- trusted server code (service role). The BEFORE trigger honours a transaction-local flag that
-- only this function can set.
-- ---------------------------------------------------------------------------
create or replace function public.project_units_touch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.price_thb is distinct from old.price_thb
     or new.status is distinct from old.status
     or new.currency is distinct from old.currency
     or current_setting('offplan.confirm_prices', true) = 'on' then
    new.price_updated_at := now();
  else
    new.price_updated_at := old.price_updated_at;  -- freshness cannot be forged
  end if;
  if auth.uid() is not null and not public.is_staff() and new.source = 'operator' then
    new.source := 'developer';
  end if;
  return new;
end $$;

create or replace function public.confirm_project_prices(p_project_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is not null and not public.is_staff() and not exists (
    select 1
    from public.catalog_projects cp
    join public.profiles pr on pr.org_id = cp.org_id
    where cp.id = p_project_id and pr.id = auth.uid() and pr.role = 'partner'
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform set_config('offplan.confirm_prices', 'on', true);
  update public.project_units set price_updated_at = now()
   where project_id = p_project_id and status <> 'sold';
  get diagnostics n = row_count;
  perform set_config('offplan.confirm_prices', 'off', true);
  return n;
end $$;

revoke all on function public.confirm_project_prices(uuid) from public;
grant execute on function public.confirm_project_prices(uuid) to authenticated, service_role;
