-- Private service-only buckets shared by all application instances.
create table public.request_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null
);
create index request_rate_limits_expiry_idx on public.request_rate_limits(expires_at);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.request_rate_limits to service_role;
create policy rate_limits_service_only on public.request_rate_limits
  for all to service_role using (true) with check (true);

-- SECURITY INVOKER: only service_role can call and access the buckets.
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_expires timestamptz;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_limit is null or p_limit < 1 or p_limit > 10000
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;
  -- Bounded cleanup of expired transient buckets; no business records are touched.
  delete from public.request_rate_limits where bucket_key in (
    select bucket_key from public.request_rate_limits where expires_at < v_now
    order by expires_at limit 100 for update skip locked
  );
  insert into public.request_rate_limits as b (bucket_key, hits, expires_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update set
    hits = case when b.expires_at <= v_now then 1 else least(b.hits + 1, p_limit + 1) end,
    expires_at = case when b.expires_at <= v_now then excluded.expires_at else b.expires_at end
  returning hits, expires_at into v_hits, v_expires;
  return jsonb_build_object('ok', v_hits <= p_limit,
    'retry_after_ms', case when v_hits <= p_limit then 0 else greatest(0, ceil(extract(epoch from (v_expires - v_now)) * 1000)) end);
end;
$$;
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
