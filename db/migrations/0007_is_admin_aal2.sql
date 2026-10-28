-- 0007_is_admin_aal2.sql — Require AAL2 for admin access, add internal notes, and product SEO fields

-- 1. Require AAL2 in is_admin() and is_owner()
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
      and coalesce(
        auth.jwt() ->> 'aal',
        nullif(current_setting('request.jwt.claim.aal', true), ''),
        'aal1'
      ) = 'aal2'
  );
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
      and role = 'owner'
      and coalesce(
        auth.jwt() ->> 'aal',
        nullif(current_setting('request.jwt.claim.aal', true), ''),
        'aal1'
      ) = 'aal2'
  );
$$;

-- 2. Add internal_notes column to orders
alter table public.orders add column if not exists internal_notes text;

-- 3. Dedicated admin function to set order internal notes with audit log
create or replace function public.set_order_internal_notes(p_order uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'AKM_FORBIDDEN'; end if;
  update public.orders set internal_notes = p_notes where id = p_order;
  if not found then raise exception 'AKM_ORDER_NOT_FOUND'; end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, detail)
  values (
    auth.uid(),
    (select email from public.admin_users where user_id = auth.uid()),
    'update_notes', 'orders', p_order::text, jsonb_build_object('internal_notes', p_notes)
  );
end $$;

grant execute on function public.set_order_internal_notes(uuid, text) to authenticated, service_role;

-- 4. Add SEO meta fields to products
alter table public.products add column if not exists meta_title text;
alter table public.products add column if not exists meta_description text;
