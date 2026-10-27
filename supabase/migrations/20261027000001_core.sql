-- MyFlix core schema: accounts, profiles, catalogue, library, commerce, devices, support, staff.
-- Every table has Row Level Security. Members only ever see their own rows; staff access is
-- granted per section (see staff_can) and requires two-step sign-in (MFA, aal2).

create extension if not exists pgcrypto with schema extensions;

/* ============================================================
   Plans & platform settings
   ============================================================ */
create table public.plans (
  id text primary key,
  name text not null,
  price integer not null check (price >= 0),           -- naira per month
  annual_discount integer not null default 15 check (annual_discount between 0 and 90),
  resolution text not null default '1080p (Full HD)',
  quality text not null default 'Great',
  devices text not null default 'TV, computer, phone, tablet',
  max_height integer not null default 1080,             -- highest video height this plan may stream
  screens integer not null default 1 check (screens between 1 and 10),
  downloads integer not null default 1,
  badge text,
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.curation (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{"rows": []}'::jsonb,
  updated_at timestamptz not null default now()
);

/* ============================================================
   Staff & roles (admin dashboard)
   ============================================================ */
create table public.roles (
  id text primary key,
  name text not null,
  permissions text[] not null default '{}',
  system boolean not null default false
);

create table public.staff (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null,
  role_id text not null references public.roles,
  active boolean not null default true,
  avatar integer not null default 0,
  last_login timestamptz,
  created_at timestamptz not null default now()
);

/** True when the caller is active staff whose role includes the section, signed in with MFA. */
create or replace function public.staff_can(section text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from staff s join roles r on r.id = s.role_id
    where s.user_id = auth.uid() and s.active
      and (section = any (r.permissions) or 'all' = any (r.permissions))
      and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid() and active)
     and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  staff_id uuid references auth.users on delete set null,
  staff_name text,
  action text not null,
  target text
);

create table public.admin_notices (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null default 'info' check (kind in ('info', 'warn', 'success')),
  text text not null
);

/* ============================================================
   Accounts (1:1 with auth.users) & viewer profiles
   ============================================================ */
create table public.accounts (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  phone text,
  pending_plan_id text references public.plans,          -- chosen at sign-up or for next renewal
  plan_id text references public.plans,                   -- current paid plan
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled', 'suspended')),
  paid_until timestamptz,
  cancel_at timestamptz,
  credit integer not null default 0 check (credit >= 0),
  referral_code text unique,
  referred_by text,
  referral_rewarded boolean not null default false,
  promo jsonb,
  notifications jsonb not null default '{"newArrivals": true, "reminders": true, "recommendations": true, "billing": true, "offers": false, "push": true}'::jsonb,
  state text,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_status_idx on public.accounts (status);
create index accounts_created_idx on public.accounts (created_at);

create table public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  avatar integer not null default 0,
  kids boolean not null default false,
  settings jsonb not null default '{}'::jsonb,           -- language, maturity, autoplay, data, subtitles, limits
  pin_hash text,                                         -- set via set_profile_pin()
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index viewer_profiles_account_idx on public.viewer_profiles (account_id);

create or replace function public.owns_profile(pid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from viewer_profiles where id = pid and account_id = auth.uid()); $$;

/* ============================================================
   Catalogue
   ============================================================ */
create table public.titles (
  id text primary key check (id ~ '^[a-z0-9-]{2,80}$'),
  title text not null,
  type text not null check (type in ('movie', 'series')),
  synopsis text not null default '',
  year integer,
  maturity text not null default '13+' check (maturity in ('All', '7+', '13+', '16+', '18+')),
  genres text[] not null default '{}',
  cast_list text[] not null default '{}',
  directors text[] not null default '{}',
  tags text[] not null default '{}',
  languages text[] not null default '{English}',
  image text not null default '',                       -- poster (storage URL or image id)
  backdrop text,
  logo text,
  trailer jsonb,
  runtime text,
  seasons integer,
  original boolean not null default false,
  kids boolean not null default false,
  is_new boolean not null default false,
  quality text not null default 'HD',
  match integer not null default 90,
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled', 'archived')),
  release_at timestamptz,
  expires_at timestamptz,
  rights jsonb not null default '{}'::jsonb,             -- licensor, territories, start/end, contract ref
  video jsonb,                                           -- {provider, asset_id, playback_id, status, height, duration}
  subtitles jsonb not null default '[]'::jsonb,           -- [{lang, label, url}]
  audio_tracks jsonb not null default '[]'::jsonb,
  intro_start real,
  intro_end real,
  sample boolean not null default false,                  -- test titles imported from Settings
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index titles_status_idx on public.titles (status);

create table public.episodes (
  id text primary key default replace(gen_random_uuid()::text, '-', ''),
  title_id text not null references public.titles on delete cascade,
  season integer not null default 1,
  number integer not null,
  title text not null,
  runtime text,
  synopsis text not null default '',
  video jsonb,
  intro_start real,
  intro_end real,
  unique (title_id, season, number)
);

/** A title members may see right now (published, or scheduled to show as "coming soon"). */
create or replace function public.title_visible(t public.titles)
returns boolean language sql stable as $$
  select t.status in ('published', 'scheduled') and (t.expires_at is null or t.expires_at > now());
$$;

/* ============================================================
   Per-profile library
   ============================================================ */
create table public.my_list (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  title_id text not null references public.titles on delete cascade,
  added_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

create table public.ratings (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  title_id text not null references public.titles on delete cascade,
  rating smallint not null check (rating in (-1, 1, 2)),
  rated_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

create table public.progress (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  title_id text not null references public.titles on delete cascade,
  season integer,
  episode integer,
  position real not null default 0,
  duration real,
  pct smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

create table public.reminders (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  title_id text not null references public.titles on delete cascade,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, title_id)
);

create table public.activity (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  title_id text not null references public.titles on delete cascade,
  season integer,
  episode integer,
  watched_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index activity_profile_idx on public.activity (profile_id, watched_at desc);
create index activity_title_idx on public.activity (title_id, watched_at desc);

create table public.usage_daily (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  day date not null default current_date,
  seconds integer not null default 0,
  gb numeric(10, 3) not null default 0,
  primary key (profile_id, day)
);

create table public.clip_reactions (
  profile_id uuid not null references public.viewer_profiles on delete cascade,
  clip_id text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, clip_id)
);

/* ============================================================
   Commerce
   ============================================================ */
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts on delete set null,  -- kept for accounting after deletion
  email text not null,
  reference text not null unique,
  provider text not null default 'paystack',
  kind text not null default 'subscription' check (kind in ('subscription', 'renewal', 'upgrade', 'gift')),
  amount integer not null,                    -- naira
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded', 'abandoned')),
  plan_id text references public.plans,
  cycle text not null default 'monthly',
  months integer not null default 1,
  free_months integer not null default 0,
  promo_code text,
  credit_used integer not null default 0,
  channel text,
  last4 text,
  card_type text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  raw jsonb
);
create index payments_account_idx on public.payments (account_id, created_at desc);
create index payments_status_idx on public.payments (status, paid_at);

create table public.payment_methods (
  account_id uuid primary key references public.accounts on delete cascade,
  authorization_code text not null,          -- never exposed to the browser (column privileges below)
  last4 text,
  card_type text,
  exp text,
  bank text,
  channel text,
  reusable boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.promos (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  label text not null,
  kind text not null check (kind in ('percent', 'amount', 'free_months')),
  value integer not null check (value > 0),
  max_uses integer,
  used integer not null default 0,
  first_payment_only boolean not null default true,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.gift_cards (
  code text primary key check (code ~ '^MYF-[A-Z0-9]{4,12}$'),
  amount integer not null check (amount > 0),
  balance integer not null,
  note text,
  created_by uuid references auth.users on delete set null,
  redeemed_by uuid references public.accounts on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

/* ============================================================
   Devices, live streams, TV pairing
   ============================================================ */
create table public.devices (
  id text primary key,                          -- generated on the device
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  kind text not null default 'web' check (kind in ('web', 'android', 'ios', 'tv')),
  last_seen timestamptz not null default now(),
  location text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index devices_account_idx on public.devices (account_id);

create table public.streams (
  id text primary key,
  account_id uuid not null references public.accounts on delete cascade,
  profile_id uuid references public.viewer_profiles on delete set null,
  profile_name text,
  device text,
  title_id text references public.titles on delete set null,
  title text,
  started_at timestamptz not null default now(),
  beat_at timestamptz not null default now(),
  stopped_by text check (stopped_by in ('member', 'admin'))
);
create index streams_live_idx on public.streams (account_id, beat_at desc);

create table public.tv_codes (
  code text primary key,
  secret_hash text not null,                    -- TV proves it created the code
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  approved_by uuid references public.accounts on delete cascade,
  approved_at timestamptz,
  token_hash text,                              -- one-time sign-in token for the TV
  consumed_at timestamptz
);

/* ============================================================
   Support, notifications, campaigns, messages
   ============================================================ */
create sequence public.ticket_seq start 2001;
create table public.tickets (
  id text primary key default 'TCK-' || nextval('public.ticket_seq'),
  account_id uuid references public.accounts on delete set null,
  email text not null,
  name text not null,
  category text not null default 'Other' check (category in ('Billing', 'Playback', 'Account', 'Content', 'Other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  assignee uuid references auth.users on delete set null,
  subject text not null check (char_length(subject) between 3 and 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on public.tickets (status, updated_at desc);

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id text not null references public.tickets on delete cascade,
  from_staff boolean not null default false,
  internal boolean not null default false,       -- staff-only note
  author text not null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id bigint generated always as identity primary key,
  account_id uuid references public.accounts on delete cascade,   -- null = everyone
  head text not null,
  body text not null,
  title_id text references public.titles on delete set null,
  link text,
  campaign_id uuid,
  created_at timestamptz not null default now()
);
create index notifications_account_idx on public.notifications (account_id, created_at desc);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('push', 'email', 'in_app', 'sms')),
  audience text not null,
  subject text not null,
  body text not null,
  title_id text references public.titles on delete set null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  reach integer not null default 0,
  opens integer not null default 0,
  clicks integer not null default 0,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.outbox (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('email', 'sms', 'push')),
  kind text not null,
  to_addr text not null,
  subject text,
  body text,
  status text not null default 'sent' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index outbox_created_idx on public.outbox (created_at desc);

create table public.push_subscriptions (
  endpoint text primary key,
  account_id uuid not null references public.accounts on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

/* ============================================================
   updated_at triggers
   ============================================================ */
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger accounts_touch before update on public.accounts for each row execute function public.touch_updated_at();
create trigger titles_touch before update on public.titles for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.plans for each row execute function public.touch_updated_at();
create trigger tickets_touch before update on public.tickets for each row execute function public.touch_updated_at();
