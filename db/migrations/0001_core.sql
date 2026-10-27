-- 0001_core.sql — extensions, enums, helpers, admin_users, settings, audit_log, rate_limits
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------- enums ----------
create type public.admin_role as enum ('owner', 'staff');
create type public.product_status as enum ('draft', 'published', 'archived');
create type public.category_kind as enum ('category', 'collection', 'trending', 'seasonal');
create type public.order_status as enum (
  'pending_payment', 'awaiting_verification', 'paid', 'processing',
  'shipped', 'delivered', 'cancelled', 'refunded'
);
create type public.payment_method as enum ('cod', 'card', 'instapay');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.receipt_status as enum ('pending', 'approved', 'rejected');
create type public.discount_scope as enum ('all', 'brand', 'category', 'product');
create type public.coupon_type as enum ('percent', 'fixed', 'free_shipping');

-- ---------- generic updated_at trigger ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- admin_users ----------
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.admin_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER so RLS policies on other tables can consult admin_users
-- without granting any read access to it.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner');
$$;

-- ---------- settings ----------
create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- audit_log ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- Generic audit trigger for admin-managed tables. Records who changed what.
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  eid text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  eid := coalesce(rec->>'id', rec->>'key', rec->>'user_id');
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, detail)
  values (
    auth.uid(),
    (select email from public.admin_users where user_id = auth.uid()),
    lower(tg_op), tg_table_name, eid,
    case when tg_op = 'UPDATE'
      then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else rec end
  );
  return coalesce(new, old);
end $$;

-- ---------- rate limiting (DB-backed, works on serverless) ----------
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Returns true when the call is allowed. Fixed window counter.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  cur int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else r.window_start end,
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                then 1 else r.hits + 1 end
  returning hits into cur;
  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return cur <= p_max;
end $$;
