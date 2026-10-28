/* More real analytics for the dashboard: viewing by hour, devices, states, failed payments and period-over-period. */
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => p_days);
begin
  if not (staff_can('overview') or staff_can('analytics')) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members_total', (select count(*) from accounts),
    'members_active', (select count(*) from accounts where has_access(id)),
    'members_pending', (select count(*) from accounts where status = 'pending'),
    'members_suspended', (select count(*) from accounts where status = 'suspended'),
    'cancelling', (select count(*) from accounts where status = 'cancelled' and paid_until > now()),
    'churned_period', (select count(*) from accounts where status in ('cancelled', 'past_due') and coalesce(cancel_at, paid_until) between since and now()),
    'signups_period', (select count(*) from accounts where created_at >= since),
    'mrr', (select coalesce(sum(case when a.billing_cycle = 'annual' then round(p.price * (100 - p.annual_discount) / 100.0) else p.price end), 0)
              from accounts a join plans p on p.id = a.plan_id where has_access(a.id) and a.cancel_at is null),
    'revenue_period', (select coalesce(sum(amount), 0) from payments where kind <> 'card_update' and status = 'success' and paid_at >= since),
    'refunds_period', (select coalesce(sum(amount), 0) from payments where kind <> 'card_update' and status = 'refunded' and refunded_at >= since),
    'plan_mix', (select coalesce(jsonb_object_agg(plan_id, n), '{}'::jsonb) from (select plan_id, count(*) n from accounts where has_access(id) group by plan_id) x),
    'signups_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
                       from (select date_trunc('day', created_at)::date d, count(*) n from accounts where created_at >= since group by 1) x),
    'revenue_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'amount', s) order by d), '[]'::jsonb)
                       from (select date_trunc('day', paid_at)::date d, sum(amount) s from payments where kind <> 'card_update' and status = 'success' and paid_at >= since group by 1) x),
    'watch_hours_period', (select coalesce(round(sum(seconds) / 3600.0, 1), 0) from usage_daily where day >= since::date),
    'watch_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'hours', round(h, 1)) order by day), '[]'::jsonb)
                     from (select day, sum(seconds) / 3600.0 h from usage_daily where day >= since::date group by 1) x),
    'top_titles', (select coalesce(jsonb_agg(jsonb_build_object('id', title_id, 'plays', n) order by n desc), '[]'::jsonb)
                    from (select title_id, count(*) n from activity where watched_at >= since group by 1 order by 2 desc limit 10) x),
    'payment_channels', (select coalesce(jsonb_object_agg(coalesce(channel, 'other'), n), '{}'::jsonb)
                          from (select channel, count(*) n from payments where kind <> 'card_update' and status = 'success' and paid_at >= since group by 1) x),
    'streams_live', (select count(*) from streams where stopped_by is null and beat_at > now() - interval '30 seconds'),
    'tickets_open', (select count(*) from tickets where status = 'open'),
    'hourly', (select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hr, 'n', n)), '[]'::jsonb)
                from (select extract(isodow from watched_at at time zone 'Africa/Lagos')::int dow,
                             extract(hour from watched_at at time zone 'Africa/Lagos')::int hr, count(*) n
                        from activity where watched_at >= since group by 1, 2) x),
    'device_kinds', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
                      from (select kind, count(*) n from devices where last_seen >= since and revoked_at is null group by 1) x),
    'by_state', (select coalesce(jsonb_object_agg(coalesce(nullif(state, ''), 'Not set'), n), '{}'::jsonb)
                  from (select state, count(*) n from accounts group by 1) x),
    'failed_period', (select count(*) from payments where kind <> 'card_update' and status = 'failed' and created_at >= since),
    'revenue_prev', (select coalesce(sum(amount), 0) from payments where kind <> 'card_update' and status = 'success' and paid_at >= since - make_interval(days => p_days) and paid_at < since),
    'signups_prev', (select count(*) from accounts where created_at >= since - make_interval(days => p_days) and created_at < since)
  );
end $$;

/* Live Now page: streams playing right now (with each account's screen limit) and recent TV sign-in codes.
   TV secrets and sign-in tokens are never returned. */
create or replace function public.admin_live()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not staff_can('analytics') then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'streams', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', s.id, 'account_id', s.account_id, 'email', a.email, 'profile', s.profile_name, 'device', s.device,
                  'title_id', s.title_id, 'title', s.title, 'started_at', s.started_at, 'beat_at', s.beat_at,
                  'screens', coalesce(p.screens, 1)) order by s.started_at desc), '[]'::jsonb)
                from streams s join accounts a on a.id = s.account_id left join plans p on p.id = a.plan_id
               where s.stopped_by is null and s.beat_at > now() - interval '30 seconds'),
    'tv_codes', (select coalesce(jsonb_agg(jsonb_build_object(
                  'code', t.code, 'created_at', t.created_at, 'expires_at', t.expires_at,
                  'approved_email', a.email, 'approved_at', t.approved_at, 'consumed_at', t.consumed_at) order by t.created_at desc), '[]'::jsonb)
                 from (select * from tv_codes order by created_at desc limit 12) t left join accounts a on a.id = t.approved_by)
  );
end $$;

create or replace function public.admin_stop_stream(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (staff_can('analytics') or staff_can('users')) then raise exception 'Not allowed.' using errcode = '42501'; end if;
  update streams set stopped_by = 'admin' where id = p_id;
  perform admin_log('Stopped a stream', p_id);
end $$;

revoke execute on function public.admin_live(), public.admin_stop_stream(text) from public, anon;
grant execute on function public.admin_live(), public.admin_stop_stream(text), public.admin_stats(integer) to authenticated;

/* Billing history: hide the ₦50 card checks (they are refunded straight away). */
create or replace function public.my_billing()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'method', (select jsonb_build_object('last4', last4, 'card_type', card_type, 'exp', exp, 'bank', bank, 'channel', channel, 'reusable', reusable)
               from payment_methods where account_id = auth.uid()),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reference', reference, 'amount', amount, 'status', status, 'plan_id', plan_id,
                  'cycle', cycle, 'channel', channel, 'last4', last4, 'paid_at', paid_at, 'created_at', created_at) order by created_at desc)
               from payments where account_id = auth.uid() and status in ('success', 'refunded') and kind <> 'card_update'), '[]'::jsonb)
  );
$$;
