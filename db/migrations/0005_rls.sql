-- 0005_rls.sql — Row Level Security on EVERY table, plus least-privilege grants.
-- Roles: anon (visitors), authenticated (any signed-in Supabase user; only admin_users rows are admins),
--        service_role (server only, bypasses RLS).

-- ---------- deny by default ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

-- ---------- enable RLS everywhere ----------
alter table public.admin_users        enable row level security;
alter table public.settings           enable row level security;
alter table public.audit_log          enable row level security;
alter table public.rate_limits        enable row level security;
alter table public.brands             enable row level security;
alter table public.categories         enable row level security;
alter table public.products           enable row level security;
alter table public.product_images     enable row level security;
alter table public.product_variants   enable row level security;
alter table public.product_categories enable row level security;
alter table public.homepage_sections  enable row level security;
alter table public.offers             enable row level security;
alter table public.offer_rules        enable row level security;
alter table public.coupons            enable row level security;
alter table public.shipping_zones     enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.payments           enable row level security;
alter table public.instapay_receipts  enable row level security;
alter table public.order_events       enable row level security;

-- ---------- grants (RLS still filters rows) ----------
grant select on public.settings, public.brands, public.categories, public.products, public.product_images,
  public.product_categories, public.homepage_sections, public.offers, public.shipping_zones to anon, authenticated;
grant select on public.storefront_products, public.public_variants to anon, authenticated;

-- authenticated: only meaningful for admins, because every policy below checks admin_users
grant select, insert, update, delete on public.settings, public.brands, public.categories, public.products,
  public.product_images, public.product_variants, public.product_categories, public.homepage_sections,
  public.offers, public.offer_rules, public.coupons, public.shipping_zones, public.admin_users to authenticated;
grant select on public.orders, public.order_items, public.payments, public.instapay_receipts,
  public.order_events, public.audit_log to authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- function execute grants ----------
grant execute on function public.is_admin(), public.is_owner() to anon, authenticated, service_role;
-- helpers called from the public views (see note on public_setting_int); none can read private data
grant execute on function public.public_setting_int(text, int), public.active_offer_percent(uuid),
  public.apply_percent(int, int) to anon, authenticated, service_role;
grant execute on function public.shop_products(text[], text, text[], int, int, boolean, boolean, text, text, int, int)
  to anon, authenticated, service_role;
grant execute on function public.search_suggest(text) to anon, authenticated, service_role;
grant execute on function public.set_order_status(uuid, public.order_status, text) to authenticated, service_role;
grant execute on function public.review_receipt(uuid, boolean, text) to authenticated, service_role;
grant execute on function public.delete_demo_data() to authenticated, service_role;
-- server-only
grant execute on function public.create_order(jsonb), public.quote_cart(jsonb) to service_role;
grant execute on function public.track_order(text, text) to service_role;
grant execute on function public.attach_receipt(uuid, text) to service_role;
grant execute on function public.system_set_order_status(uuid, public.order_status, text, text) to service_role;
grant execute on function public.expire_unpaid_orders(int) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.gen_order_number(), public.setting_int(text, int) to service_role;

-- ---------- policies ----------
-- admin_users: you can see yourself; owners manage everyone.
create policy admin_users_self_read on public.admin_users for select to authenticated
  using (user_id = auth.uid() or public.is_owner());
create policy admin_users_owner_write on public.admin_users for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- settings: public ones are readable by everyone; staff can read all; only owners write.
create policy settings_public_read on public.settings for select to anon, authenticated using (is_public);
create policy settings_admin_read on public.settings for select to authenticated using (public.is_admin());
create policy settings_owner_write on public.settings for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- audit_log: owners read; nobody writes directly (triggers/functions are SECURITY DEFINER).
create policy audit_owner_read on public.audit_log for select to authenticated using (public.is_owner());

-- rate_limits: no policies => no direct access for anyone but service_role / definer functions.

-- catalog: public reads published/active rows; staff + owners write; only owners delete products.
create policy brands_public_read on public.brands for select to anon, authenticated using (is_active);
create policy brands_admin_all on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active);
create policy categories_admin_all on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_public_read on public.products for select to anon, authenticated using (status = 'published');
create policy products_admin_read on public.products for select to authenticated using (public.is_admin());
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy products_owner_delete on public.products for delete to authenticated using (public.is_owner());

create policy images_public_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy images_admin_all on public.product_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- variants: NO public policy. Visitors read the public_variants view (no exact stock, no SKU).
create policy variants_admin_all on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy pcat_public_read on public.product_categories for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy pcat_admin_all on public.product_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- merchandising: public reads active; staff read all; owners write
create policy homepage_public_read on public.homepage_sections for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy homepage_admin_read on public.homepage_sections for select to authenticated using (public.is_admin());
create policy homepage_owner_write on public.homepage_sections for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy offers_public_read on public.offers for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy offers_admin_read on public.offers for select to authenticated using (public.is_admin());
create policy offers_owner_write on public.offers for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy offer_rules_admin_read on public.offer_rules for select to authenticated using (public.is_admin());
create policy offer_rules_owner_write on public.offer_rules for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy coupons_admin_read on public.coupons for select to authenticated using (public.is_admin());
create policy coupons_owner_write on public.coupons for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy shipping_public_read on public.shipping_zones for select to anon, authenticated using (is_active);
create policy shipping_admin_read on public.shipping_zones for select to authenticated using (public.is_admin());
create policy shipping_owner_write on public.shipping_zones for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- orders & everything attached: admins read only. All writes go through SECURITY DEFINER functions.
create policy orders_admin_read on public.orders for select to authenticated using (public.is_admin());
create policy order_items_admin_read on public.order_items for select to authenticated using (public.is_admin());
create policy payments_admin_read on public.payments for select to authenticated using (public.is_admin());
create policy receipts_admin_read on public.instapay_receipts for select to authenticated using (public.is_admin());
create policy order_events_admin_read on public.order_events for select to authenticated using (public.is_admin());

-- ---------- never lock the business out ----------
create or replace function public.guard_last_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'owner')) and old.role = 'owner'
     and (select count(*) from public.admin_users where role = 'owner' and user_id <> old.user_id) = 0 then
    raise exception 'AKM_LAST_OWNER';
  end if;
  return coalesce(new, old);
end $$;
create trigger admin_users_guard before update or delete on public.admin_users
  for each row execute function public.guard_last_owner();
