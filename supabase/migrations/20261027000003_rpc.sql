-- Functions called by the website, apps and admin (via supabase.rpc). All check auth.uid().

/* ============================================================
   Profiles
   ============================================================ */
create or replace function public.set_profile_pin(pid uuid, pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not owns_profile(pid) then raise exception 'Not your profile.' using errcode = '42501'; end if;
  if pin is null or pin = '' then
    delete from profile_pins where profile_id = pid;
    update viewer_profiles set has_pin = false where id = pid;
  else
    if pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits.'; end if;
    insert into profile_pins (profile_id, pin_hash) values (pid, crypt(pin, gen_salt('bf')))
      on conflict (profile_id) do update set pin_hash = excluded.pin_hash;
    update viewer_profiles set has_pin = true where id = pid;
  end if;
end $$;

create or replace function public.check_profile_pin(pid uuid, pin text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select owns_profile(pid) and exists (select 1 from profile_pins where profile_id = pid and pin_hash = crypt(pin, pin_hash));
$$;

/* ============================================================
   Pricing (single source of truth for website, apps and payments)
   ============================================================ */
create or replace function public.price_quote(p_account uuid, p_plan text, p_cycle text, p_promo text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pl plans;
  pr promos;
  acc accounts;
  base integer;
  months integer := case when p_cycle = 'annual' then 12 else 1 end;
  discount integer := 0;
  free_months integer := 0;
  credit_used integer := 0;
  label text;
  promo_error text;
  has_paid boolean;
begin
  select * into pl from plans where id = p_plan and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'That plan is not available.'); end if;
  select * into acc from accounts where id = p_account;
  base := case when p_cycle = 'annual' then round(pl.price * 12 * (100 - pl.annual_discount) / 100.0)::int else pl.price end;

  if coalesce(p_promo, '') <> '' then
    select * into pr from promos where code = upper(trim(p_promo));
    has_paid := exists (select 1 from payments where account_id = p_account and status = 'success');
    if not found or not pr.active then promo_error := 'That promo code isn''t valid.';
    elsif pr.expires_at is not null and pr.expires_at < now() then promo_error := 'That promo code has expired.';
    elsif pr.max_uses is not null and pr.used >= pr.max_uses then promo_error := 'That promo code has been fully used.';
    elsif pr.first_payment_only and has_paid then promo_error := 'That promo code is for new members only.';
    else
      label := pr.label;
      if pr.kind = 'percent' then discount := round(base * least(pr.value, 100) / 100.0)::int;
      elsif pr.kind = 'amount' then discount := least(pr.value, base);
      else free_months := pr.value;
      end if;
    end if;
  end if;

  credit_used := least(coalesce(acc.credit, 0), base - discount);
  return jsonb_build_object(
    'ok', true,
    'plan', pl.id,
    'cycle', p_cycle,
    'months', months,
    'base', base,
    'discount', discount,
    'credit_used', credit_used,
    'free_months', free_months,
    'amount', base - discount - credit_used,
    'promo', case when label is not null then jsonb_build_object('code', upper(trim(p_promo)), 'label', label) end,
    'promo_error', promo_error
  );
end $$;

create or replace function public.my_quote(p_plan text, p_cycle text default 'monthly', p_promo text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select price_quote(auth.uid(), p_plan, p_cycle, p_promo);
$$;

/* ============================================================
   Membership self-service
   ============================================================ */
create or replace function public.choose_plan(p_plan text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from plans where id = p_plan and active) then raise exception 'That plan is not available.'; end if;
  update accounts set pending_plan_id = p_plan where id = auth.uid();
end $$;

/** Upgrades apply now; downgrades from the next renewal. */
create or replace function public.change_plan(p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acc accounts;
  newp plans;
  curp plans;
begin
  select * into acc from accounts where id = auth.uid();
  select * into newp from plans where id = p_plan and active;
  if not found then raise exception 'That plan is not available.'; end if;
  select * into curp from plans where id = acc.plan_id;
  if acc.plan_id is null or not has_access(acc.id) then
    update accounts set pending_plan_id = p_plan where id = acc.id;
    return jsonb_build_object('when', 'payment');
  end if;
  if newp.price >= coalesce(curp.price, 0) then
    update accounts set plan_id = p_plan, pending_plan_id = null where id = acc.id;
    return jsonb_build_object('when', 'now');
  end if;
  update accounts set pending_plan_id = p_plan where id = acc.id;
  return jsonb_build_object('when', 'renewal', 'at', acc.paid_until);
end $$;

create or replace function public.cancel_membership()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare until timestamptz;
begin
  update accounts set cancel_at = coalesce(paid_until, now()), status = case when status = 'active' then 'cancelled' else status end
   where id = auth.uid() returning cancel_at into until;
  return until;
end $$;

create or replace function public.restart_membership()
returns void language plpgsql security definer set search_path = public as $$
begin
  update accounts set cancel_at = null, status = case when status = 'cancelled' and paid_until > now() then 'active' else status end
   where id = auth.uid();
end $$;

create or replace function public.redeem_gift(p_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare g gift_cards;
begin
  select * into g from gift_cards where code = upper(trim(p_code)) for update;
  if not found then raise exception 'We couldn''t find that gift card. Check the code and try again.'; end if;
  if g.balance <= 0 then raise exception 'This gift card has already been redeemed.'; end if;
  update gift_cards set balance = 0, redeemed_by = auth.uid(), redeemed_at = now() where code = g.code;
  update accounts set credit = credit + g.balance where id = auth.uid();
  return g.balance;
end $$;

/** Billing summary for the member's account page (card details without the reusable token). */
create or replace function public.my_billing()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'method', (select jsonb_build_object('last4', last4, 'card_type', card_type, 'exp', exp, 'bank', bank, 'channel', channel, 'reusable', reusable)
               from payment_methods where account_id = auth.uid()),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reference', reference, 'amount', amount, 'status', status, 'plan_id', plan_id,
                  'cycle', cycle, 'channel', channel, 'last4', last4, 'paid_at', paid_at, 'created_at', created_at) order by created_at desc)
               from payments where account_id = auth.uid() and status in ('success', 'refunded')), '[]'::jsonb)
  );
$$;

/* ============================================================
   Devices & concurrent streams
   ============================================================ */
create or replace function public.touch_device(p_id text, p_name text, p_kind text default 'web')
returns boolean language plpgsql security definer set search_path = public as $$
declare d devices;
begin
  select * into d from devices where id = p_id;
  if found and d.account_id <> auth.uid() then
    -- device moved to another account: start fresh
    delete from devices where id = p_id;
  elsif found and d.revoked_at is not null then
    return false;  -- signed out remotely
  end if;
  insert into devices (id, account_id, name, kind, last_seen)
  values (p_id, auth.uid(), left(p_name, 80), case when p_kind in ('web', 'android', 'ios', 'tv') then p_kind else 'web' end, now())
  on conflict (id) do update set last_seen = now(), name = excluded.name;
  return true;
end $$;

/** Start or keep a stream. Enforces membership and the plan's screen limit. */
create or replace function public.claim_stream(p_id text, p_profile uuid, p_device text, p_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  acc accounts;
  mine streams;
  limit_n integer;
  others jsonb;
  enforced boolean := coalesce((select (data ->> 'streamLimitEnforced')::boolean from site_settings where id = 1), true);
  t titles;
begin
  select * into acc from accounts where id = auth.uid();
  if not found then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if acc.status = 'suspended' then return jsonb_build_object('ok', false, 'reason', 'suspended'); end if;
  if not has_access(acc.id) then return jsonb_build_object('ok', false, 'reason', 'membership'); end if;
  if not owns_profile(p_profile) then return jsonb_build_object('ok', false, 'reason', 'profile'); end if;

  select * into mine from streams where id = p_id;
  if found and mine.account_id = acc.id and mine.stopped_by is not null then
    return jsonb_build_object('ok', false, 'reason', 'stopped', 'by', mine.stopped_by);
  end if;

  select screens into limit_n from plans where id = acc.plan_id;
  limit_n := coalesce(limit_n, 1);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'profile', profile_name, 'device', device, 'title', title)), '[]'::jsonb)
    into others
    from streams
   where account_id = acc.id and id <> p_id and stopped_by is null and beat_at > now() - interval '30 seconds';

  if mine.id is null and enforced and jsonb_array_length(others) >= limit_n then
    return jsonb_build_object('ok', false, 'reason', 'screens', 'limit', limit_n, 'others', others);
  end if;

  select * into t from titles where id = p_title;
  insert into streams (id, account_id, profile_id, profile_name, device, title_id, title, beat_at)
  values (p_id, acc.id, p_profile, (select name from viewer_profiles where id = p_profile), left(p_device, 80), t.id, t.title, now())
  on conflict (id) do update set beat_at = now();

  -- tidy up old rows
  delete from streams where beat_at < now() - interval '1 day';
  return jsonb_build_object('ok', true, 'max_height', (select max_height from plans where id = acc.plan_id));
end $$;

create or replace function public.stop_stream(p_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.staff_can('analytics') then
    update streams set stopped_by = 'admin' where id = p_id;
  else
    update streams set stopped_by = 'member' where id = p_id and account_id = auth.uid();
  end if;
end $$;

create or replace function public.end_stream(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from streams where id = p_id and account_id = auth.uid();
$$;

/* ============================================================
   Usage meter & views
   ============================================================ */
create or replace function public.add_usage(p_profile uuid, p_seconds integer, p_gb numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not owns_profile(p_profile) then return; end if;
  insert into usage_daily (profile_id, day, seconds, gb)
  values (p_profile, current_date, greatest(0, least(p_seconds, 600)), greatest(0, least(p_gb, 5)))
  on conflict (profile_id, day) do update set seconds = usage_daily.seconds + excluded.seconds, gb = usage_daily.gb + excluded.gb;
end $$;

create or replace function public.count_view()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update titles set views = views + 1 where id = new.title_id;
  return new;
end $$;
drop trigger if exists activity_count_view on public.activity;
create trigger activity_count_view after insert on public.activity for each row execute function public.count_view();

/* ============================================================
   Support
   ============================================================ */
create or replace function public.create_ticket(p_category text, p_subject text, p_body text)
returns text language plpgsql security definer set search_path = public as $$
declare
  acc accounts;
  pname text;
  tid text;
begin
  select * into acc from accounts where id = auth.uid();
  if not found then raise exception 'Please sign in.'; end if;
  select name into pname from viewer_profiles where account_id = acc.id order by sort, created_at limit 1;
  insert into tickets (account_id, email, name, category, subject, priority)
  values (acc.id, acc.email, coalesce(pname, split_part(acc.email, '@', 1)),
          case when p_category in ('Billing', 'Playback', 'Account', 'Content', 'Other') then p_category else 'Other' end,
          left(p_subject, 140), case when p_category = 'Billing' then 'high' else 'normal' end)
  returning id into tid;
  insert into ticket_messages (ticket_id, from_staff, author, body) values (tid, false, coalesce(pname, acc.email), left(p_body, 5000));
  return tid;
end $$;

/* ============================================================
   Admin helpers
   ============================================================ */
create or replace function public.admin_log(p_action text, p_target text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then return; end if;
  insert into audit_log (staff_id, staff_name, action, target)
  values (auth.uid(), (select name from staff where user_id = auth.uid()), left(p_action, 200), left(p_target, 300));
end $$;

/** Business metrics for the admin Overview and Analytics pages (real data only). */
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
    'revenue_period', (select coalesce(sum(amount), 0) from payments where status = 'success' and paid_at >= since),
    'refunds_period', (select coalesce(sum(amount), 0) from payments where status = 'refunded' and refunded_at >= since),
    'plan_mix', (select coalesce(jsonb_object_agg(plan_id, n), '{}'::jsonb) from (select plan_id, count(*) n from accounts where has_access(id) group by plan_id) x),
    'signups_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
                       from (select date_trunc('day', created_at)::date d, count(*) n from accounts where created_at >= since group by 1) x),
    'revenue_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'amount', s) order by d), '[]'::jsonb)
                       from (select date_trunc('day', paid_at)::date d, sum(amount) s from payments where status = 'success' and paid_at >= since group by 1) x),
    'watch_hours_period', (select coalesce(round(sum(seconds) / 3600.0, 1), 0) from usage_daily where day >= since::date),
    'watch_daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'hours', round(h, 1)) order by day), '[]'::jsonb)
                     from (select day, sum(seconds) / 3600.0 h from usage_daily where day >= since::date group by 1) x),
    'top_titles', (select coalesce(jsonb_agg(jsonb_build_object('id', title_id, 'plays', n) order by n desc), '[]'::jsonb)
                    from (select title_id, count(*) n from activity where watched_at >= since group by 1 order by 2 desc limit 10) x),
    'payment_channels', (select coalesce(jsonb_object_agg(coalesce(channel, 'other'), n), '{}'::jsonb)
                          from (select channel, count(*) n from payments where status = 'success' and paid_at >= since group by 1) x),
    'streams_live', (select count(*) from streams where stopped_by is null and beat_at > now() - interval '30 seconds'),
    'tickets_open', (select count(*) from tickets where status = 'open')
  );
end $$;

/* ============================================================
   Execute permissions
   ============================================================ */
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.set_profile_pin(uuid, text), public.check_profile_pin(uuid, text), public.my_quote(text, text, text),
  public.choose_plan(text), public.change_plan(text), public.cancel_membership(), public.restart_membership(),
  public.redeem_gift(text), public.my_billing(), public.touch_device(text, text, text),
  public.claim_stream(text, uuid, text, text), public.stop_stream(text), public.end_stream(text),
  public.add_usage(uuid, integer, numeric), public.create_ticket(text, text, text), public.admin_log(text, text),
  public.admin_stats(integer), public.staff_can(text), public.is_staff(), public.has_access(uuid), public.owns_profile(uuid)
to authenticated;
grant execute on function public.title_visible(public.titles), public.staff_can(text) to anon, authenticated;
grant execute on all functions in schema public to service_role;
