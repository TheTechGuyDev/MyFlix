-- Allow ₦50 card-check payments (refunded straight away) used to change the saved card.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('subscription', 'renewal', 'upgrade', 'gift', 'card_update'));

-- Promo codes can be limited to certain plans (empty = all plans)
alter table public.promos add column if not exists plans text[] not null default '{}';

create or replace function public.promo_plan_ok(p_code text, p_plan text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select cardinality(plans) = 0 or p_plan = any (plans) from promos where code = upper(trim(p_code))), true);
$$;
