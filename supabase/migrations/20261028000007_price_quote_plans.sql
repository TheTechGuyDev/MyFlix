-- price_quote: respect plan restrictions on promo codes.
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
    has_paid := exists (select 1 from payments where account_id = p_account and status = 'success' and kind <> 'card_update');
    if not found or not pr.active then promo_error := 'That promo code isn''t valid.';
    elsif pr.expires_at is not null and pr.expires_at < now() then promo_error := 'That promo code has expired.';
    elsif pr.max_uses is not null and pr.used >= pr.max_uses then promo_error := 'That promo code has been fully used.';
    elsif pr.first_payment_only and has_paid then promo_error := 'That promo code is for new members only.';
    elsif cardinality(pr.plans) > 0 and not (p_plan = any (pr.plans)) then promo_error := 'That code doesn''t apply to this plan.';
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
    'ok', true, 'plan', pl.id, 'cycle', p_cycle, 'months', months, 'base', base, 'discount', discount,
    'credit_used', credit_used, 'free_months', free_months, 'amount', base - discount - credit_used,
    'promo', case when label is not null then jsonb_build_object('code', upper(trim(p_promo)), 'label', label) end,
    'promo_error', promo_error
  );
end $$;
revoke execute on function public.price_quote(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.price_quote(uuid, text, text, text) to service_role;
revoke execute on function public.promo_plan_ok(text, text) from public, anon;
