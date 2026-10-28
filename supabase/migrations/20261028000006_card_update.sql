-- Allow ₦50 card-check payments (refunded straight away) used to change the saved card.
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (kind in ('subscription', 'renewal', 'upgrade', 'gift', 'card_update'));
