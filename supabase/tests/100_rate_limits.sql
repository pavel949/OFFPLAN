begin;
do $$
begin
  if has_function_privilege('anon', 'public.consume_rate_limit(text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.consume_rate_limit(text,integer,integer)', 'execute') then
    raise exception 'rate limiter RPC exposed';
  end if;
  if has_table_privilege('anon', 'public.request_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.request_rate_limits', 'insert') then
    raise exception 'rate limiter buckets exposed';
  end if;
end $$;
set local role service_role;
do $$
declare k text := repeat('a',64); r jsonb;
begin
  r := public.consume_rate_limit(k, 2, 60);
  if not (r->>'ok')::boolean then raise exception 'first request denied'; end if;
  r := public.consume_rate_limit(k, 2, 60);
  if not (r->>'ok')::boolean then raise exception 'second request denied'; end if;
  r := public.consume_rate_limit(k, 2, 60);
  if (r->>'ok')::boolean or (r->>'retry_after_ms')::numeric <= 0 then raise exception 'excess request accepted'; end if;
  update public.request_rate_limits set expires_at = now() - interval '1 second' where bucket_key=k;
  r := public.consume_rate_limit(k, 2, 60);
  if not (r->>'ok')::boolean then raise exception 'expired window did not reset'; end if;
end $$;
reset role;
rollback;
select 'rate limits: OK';
