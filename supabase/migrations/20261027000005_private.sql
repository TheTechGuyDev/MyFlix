-- Server-only key/value store (e.g. the Mux signing key the platform creates for itself).
-- The private schema is not exposed through the API; only edge functions (service role) use it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
grant all on private.secrets to service_role;

create or replace function public.get_private_secret(p_name text)
returns text language sql stable security definer set search_path = private as $$
  select value from private.secrets where name = p_name;
$$;
create or replace function public.set_private_secret(p_name text, p_value text)
returns void language sql security definer set search_path = private as $$
  insert into private.secrets (name, value) values (p_name, p_value)
  on conflict (name) do update set value = excluded.value;
$$;
revoke execute on function public.get_private_secret(text), public.set_private_secret(text, text) from public, anon, authenticated;
grant execute on function public.get_private_secret(text), public.set_private_secret(text, text) to service_role;
