/* "New sign-ups open" switch in Settings, enforced in the database.
   Invited staff, and the very first account (the platform owner), can always be created. */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref text := upper(coalesce(new.raw_user_meta_data ->> 'ref', ''));
  open_signups boolean := coalesce((select (data ->> 'signupsOpen')::boolean from site_settings where id = 1), true);
begin
  if not open_signups and new.invited_at is null and exists (select 1 from staff) then
    raise exception 'New sign-ups are paused right now. Please try again later.';
  end if;
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
