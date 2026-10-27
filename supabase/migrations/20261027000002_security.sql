-- Account creation, protections, Row Level Security policies and grants.

/* ============================================================
   New auth user -> account row
   ============================================================ */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref text := upper(coalesce(new.raw_user_meta_data ->> 'ref', ''));
begin
  insert into accounts (id, email, phone, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.phone, ''),
    'NAIJA' || upper(substr(md5(new.id::text), 1, 6)),
    case when ref ~ '^NAIJA[A-Z0-9]{4,8}$' then ref end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep email / verified phone in sync when they change in auth
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update accounts
     set email = coalesce(new.email, email),
         phone = case when new.phone_confirmed_at is not null then nullif(new.phone, '') else phone end
   where id = new.id;
  return new;
end $$;

create trigger on_auth_user_updated after update of email, phone, phone_confirmed_at on auth.users
  for each row execute function public.handle_user_updated();

/* ============================================================
   Members can't change billing fields on their own account
   ============================================================ */
-- Runs as the caller (security invoker) so current_user is the real API role.
create or replace function public.protect_account()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or public.staff_can('users') then
    return new;
  end if;
  if new.plan_id is distinct from old.plan_id
     or new.status is distinct from old.status
     or new.paid_until is distinct from old.paid_until
     or new.cancel_at is distinct from old.cancel_at
     or new.credit is distinct from old.credit
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.referral_code is distinct from old.referral_code
     or new.referral_rewarded is distinct from old.referral_rewarded
     or new.promo is distinct from old.promo
     or new.staff_notes is distinct from old.staff_notes
     or new.billing_cycle is distinct from old.billing_cycle
     or (old.referred_by is not null and new.referred_by is distinct from old.referred_by) then
    raise exception 'Those account fields can only be changed by MyFlix.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger accounts_protect before update on public.accounts
  for each row execute function public.protect_account();

/* Profile limit per account (Settings > Max profiles, default 5) */
create or replace function public.limit_profiles()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_profiles integer := coalesce((select (data ->> 'maxProfiles')::int from site_settings where id = 1), 5);
begin
  if (select count(*) from viewer_profiles where account_id = new.account_id) >= max_profiles then
    raise exception 'You can have up to % profiles.', max_profiles using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger viewer_profiles_limit before insert on public.viewer_profiles
  for each row execute function public.limit_profiles();

-- Profile PINs live in their own table that clients can't read.
create table public.profile_pins (
  profile_id uuid primary key references public.viewer_profiles on delete cascade,
  pin_hash text not null
);
alter table public.viewer_profiles add column has_pin boolean not null default false;
alter table public.viewer_profiles drop column pin_hash;

/** Has the account got streaming access right now? (Cancelled members keep access until paid_until.) */
create or replace function public.has_access(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts
    where id = uid and status in ('active', 'cancelled', 'past_due') and paid_until > now()
  );
$$;

/* ============================================================
   Row Level Security
   ============================================================ */
alter table public.plans enable row level security;
alter table public.site_settings enable row level security;
alter table public.curation enable row level security;
alter table public.roles enable row level security;
alter table public.staff enable row level security;
alter table public.audit_log enable row level security;
alter table public.admin_notices enable row level security;
alter table public.accounts enable row level security;
alter table public.viewer_profiles enable row level security;
alter table public.profile_pins enable row level security;
alter table public.titles enable row level security;
alter table public.episodes enable row level security;
alter table public.my_list enable row level security;
alter table public.ratings enable row level security;
alter table public.progress enable row level security;
alter table public.reminders enable row level security;
alter table public.activity enable row level security;
alter table public.usage_daily enable row level security;
alter table public.clip_reactions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_methods enable row level security;
alter table public.promos enable row level security;
alter table public.gift_cards enable row level security;
alter table public.devices enable row level security;
alter table public.streams enable row level security;
alter table public.tv_codes enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.campaigns enable row level security;
alter table public.outbox enable row level security;
alter table public.push_subscriptions enable row level security;

-- Plans, settings, curation: public read, staff write
create policy plans_read on public.plans for select to anon, authenticated using (active or public.staff_can('plans'));
create policy plans_write on public.plans for all to authenticated using (public.staff_can('plans')) with check (public.staff_can('plans'));
create policy settings_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_write on public.site_settings for update to authenticated using (public.staff_can('settings')) with check (public.staff_can('settings'));
create policy curation_read on public.curation for select to anon, authenticated using (true);
create policy curation_write on public.curation for update to authenticated using (public.staff_can('curation')) with check (public.staff_can('curation'));

-- Staff
create policy roles_read on public.roles for select to authenticated using (public.is_staff() or exists (select 1 from staff where user_id = auth.uid()));
create policy roles_write on public.roles for all to authenticated using (public.staff_can('staff')) with check (public.staff_can('staff'));
create policy staff_read on public.staff for select to authenticated using (user_id = auth.uid() or public.staff_can('staff') or public.is_staff());
create policy staff_write on public.staff for all to authenticated using (public.staff_can('staff')) with check (public.staff_can('staff'));
create policy audit_read on public.audit_log for select to authenticated using (public.staff_can('audit'));
create policy audit_insert on public.audit_log for insert to authenticated with check (public.is_staff() and staff_id = auth.uid());
create policy notices_all on public.admin_notices for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Accounts & profiles
create policy accounts_own on public.accounts for select to authenticated using (id = auth.uid() or public.staff_can('users') or public.staff_can('payments'));
create policy accounts_update on public.accounts for update to authenticated using (id = auth.uid() or public.staff_can('users')) with check (id = auth.uid() or public.staff_can('users'));
create policy profiles_own on public.viewer_profiles for all to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy profiles_staff on public.viewer_profiles for select to authenticated using (public.staff_can('users'));

-- Catalogue
create policy titles_read on public.titles for select to anon, authenticated using (public.title_visible(titles) or public.staff_can('content'));
create policy titles_write on public.titles for all to authenticated using (public.staff_can('content')) with check (public.staff_can('content'));
create policy episodes_read on public.episodes for select to anon, authenticated
  using (exists (select 1 from titles t where t.id = title_id and (public.title_visible(t) or public.staff_can('content'))));
create policy episodes_write on public.episodes for all to authenticated using (public.staff_can('content')) with check (public.staff_can('content'));

-- Library (own profiles only)
create policy my_list_own on public.my_list for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy ratings_own on public.ratings for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy progress_own on public.progress for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy reminders_own on public.reminders for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy activity_own on public.activity for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy usage_own on public.usage_daily for select to authenticated using (public.owns_profile(profile_id));
create policy clip_reactions_own on public.clip_reactions for all to authenticated using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

-- Commerce (writes only through edge functions with the service role)
create policy payments_read on public.payments for select to authenticated using (account_id = auth.uid() or public.staff_can('payments'));
create policy promos_staff on public.promos for all to authenticated using (public.staff_can('plans')) with check (public.staff_can('plans'));
create policy gifts_staff on public.gift_cards for all to authenticated using (public.staff_can('plans')) with check (public.staff_can('plans'));

-- Devices & streams
create policy devices_own on public.devices for select to authenticated using (account_id = auth.uid() or public.staff_can('users'));
create policy devices_revoke on public.devices for update to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy devices_delete on public.devices for delete to authenticated using (account_id = auth.uid());
create policy streams_read on public.streams for select to authenticated using (account_id = auth.uid() or public.staff_can('analytics'));

-- Support
create policy tickets_member on public.tickets for select to authenticated using (account_id = auth.uid() or public.staff_can('support'));
create policy tickets_staff on public.tickets for update to authenticated using (public.staff_can('support')) with check (public.staff_can('support'));
create policy ticket_messages_read on public.ticket_messages for select to authenticated using (
  public.staff_can('support') or (not internal and exists (select 1 from tickets t where t.id = ticket_id and t.account_id = auth.uid()))
);
create policy ticket_messages_member on public.ticket_messages for insert to authenticated with check (
  not from_staff and not internal and exists (select 1 from tickets t where t.id = ticket_id and t.account_id = auth.uid())
);
create policy ticket_messages_staff on public.ticket_messages for insert to authenticated with check (public.staff_can('support'));

-- Notifications & campaigns
create policy notifications_read on public.notifications for select to authenticated using (account_id = auth.uid() or account_id is null or public.staff_can('campaigns'));
create policy notifications_staff on public.notifications for all to authenticated using (public.staff_can('campaigns')) with check (public.staff_can('campaigns'));
create policy campaigns_staff on public.campaigns for all to authenticated using (public.staff_can('campaigns')) with check (public.staff_can('campaigns'));
create policy outbox_staff on public.outbox for select to authenticated using (public.staff_can('campaigns') or public.staff_can('support'));
create policy push_own on public.push_subscriptions for all to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());

/* ============================================================
   Grants (explicit: nothing is exposed unless listed here)
   ============================================================ */
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.plans, public.site_settings, public.curation, public.titles, public.episodes to anon, authenticated;
grant insert, update, delete on public.plans, public.titles, public.episodes to authenticated;
grant update on public.site_settings, public.curation to authenticated;
grant select, insert, update, delete on public.roles, public.staff, public.admin_notices to authenticated;
grant select, insert on public.audit_log to authenticated;
grant select, update on public.accounts to authenticated;
grant select, insert, update, delete on public.viewer_profiles to authenticated;
grant select, insert, update, delete on public.my_list, public.ratings, public.progress, public.reminders, public.activity, public.clip_reactions to authenticated;
grant select on public.usage_daily to authenticated;
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.promos, public.gift_cards to authenticated;
grant select, update, delete on public.devices to authenticated;
grant select on public.streams to authenticated;
grant select, update on public.tickets to authenticated;
grant select, insert on public.ticket_messages to authenticated;
grant select, insert, update, delete on public.notifications, public.campaigns to authenticated;
grant select on public.outbox to authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;
grant usage on sequence public.ticket_seq to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

/* ============================================================
   Storage buckets: artwork & subtitles (public read, staff write)
   ============================================================ */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork', 'artwork', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('subtitles', 'subtitles', true, 2097152, array['text/vtt', 'text/plain', 'application/x-subrip'])
on conflict (id) do nothing;

create policy media_public_read on storage.objects for select to anon, authenticated using (bucket_id in ('artwork', 'subtitles'));
create policy media_staff_insert on storage.objects for insert to authenticated with check (bucket_id in ('artwork', 'subtitles') and public.staff_can('content'));
create policy media_staff_update on storage.objects for update to authenticated using (bucket_id in ('artwork', 'subtitles') and public.staff_can('content'));
create policy media_staff_delete on storage.objects for delete to authenticated using (bucket_id in ('artwork', 'subtitles') and public.staff_can('content'));
