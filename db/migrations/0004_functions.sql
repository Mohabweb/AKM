-- 0004_functions.sql — pricing, storefront views, search, order creation and lifecycle

-- ---------- helpers ----------
create or replace function public.setting_int(p_key text, p_default int default 0) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = p_key), p_default);
$$;

-- Same, but only for settings flagged is_public. This is the one the public views call: Postgres checks EXECUTE on
-- functions used in a view's columns against the CALLING role, so anon needs it — and must not be able to read
-- private settings through it.
create or replace function public.public_setting_int(p_key text, p_default int default 0) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.settings where key = p_key and is_public), p_default);
$$;

-- Best active automatic discount (percent) for a product. 0 when none.
create or replace function public.active_offer_percent(p_product uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(r.percent_off), 0)::int
  from public.offer_rules r
  join public.offers o on o.id = r.offer_id
  join public.products p on p.id = p_product
  where o.is_active
    and (o.starts_at is null or o.starts_at <= now())
    and (o.ends_at is null or o.ends_at > now())
    and (
      r.scope = 'all'
      or (r.scope = 'product'  and r.target_id = p.id)
      or (r.scope = 'brand'    and r.target_id = p.brand_id)
      or (r.scope = 'category' and exists (
            select 1 from public.product_categories pc
            where pc.product_id = p.id and pc.category_id = r.target_id))
    );
$$;

-- price after an integer percentage, rounded half-up, in bigint to avoid overflow
create or replace function public.apply_percent(p_price int, p_pct int) returns int
language sql immutable as $$
  select (p_price - ((p_price::bigint * p_pct + 50) / 100))::int;
$$;

-- ---------- storefront views (published data only) ----------
create or replace view public.storefront_products with (security_invoker = false) as
select
  p.id, p.slug, p.name, p.description,
  b.id as brand_id, b.name as brand_name, b.slug as brand_slug,
  public.apply_percent(p.price_piasters, o.pct) as price_piasters,
  coalesce(p.compare_at_piasters, p.price_piasters) as original_price_piasters,
  (public.apply_percent(p.price_piasters, o.pct) < coalesce(p.compare_at_piasters, p.price_piasters)) as is_on_sale,
  p.is_new_arrival, p.is_featured, p.sold_count, p.published_at, p.is_demo,
  (select url from public.product_images i where i.product_id = p.id order by i.sort_order, i.created_at limit 1) as image_url,
  (select url from public.product_images i where i.product_id = p.id order by i.sort_order, i.created_at offset 1 limit 1) as image2_url,
  exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active and v.stock > 0) as in_stock
from public.products p
left join public.brands b on b.id = p.brand_id and b.is_active
cross join lateral (select public.active_offer_percent(p.id) as pct) o
where p.status = 'published';

-- Variants without exact stock numbers. stock_left appears only at/below the owner's low-stock threshold.
create or replace view public.public_variants with (security_invoker = false) as
select
  v.id, v.product_id, v.size, v.color,
  (v.stock > 0) as in_stock,
  case when v.stock > 0 and v.stock <= public.public_setting_int('low_stock_threshold', 0) then v.stock end as stock_left
from public.product_variants v
join public.products p on p.id = v.product_id and p.status = 'published'
where v.is_active;

-- ---------- shop listing ----------
create or replace function public.shop_products(
  p_brands text[] default null,
  p_category text default null,
  p_sizes text[] default null,
  p_min int default null,
  p_max int default null,
  p_sale boolean default false,
  p_new boolean default false,
  p_q text default null,
  p_sort text default 'recommended',
  p_limit int default 24,
  p_offset int default 0
) returns table (product jsonb, total_count bigint)
language sql stable set search_path = public as $$
  with recursive cats as (
    select c.id from public.categories c where c.slug = p_category and c.is_active
    union all
    select c.id from public.categories c join cats on c.parent_id = cats.id where c.is_active
  ),
  q as (
    select sp.*
    from public.storefront_products sp
    where (p_brands is null or sp.brand_slug = any (p_brands))
      and (p_category is null or exists (
            select 1 from public.product_categories pc
            where pc.product_id = sp.id and pc.category_id in (select id from cats)))
      and (p_sizes is null or exists (
            select 1 from public.public_variants v
            where v.product_id = sp.id and v.in_stock and v.size = any (p_sizes)))
      and (p_min is null or sp.price_piasters >= p_min)
      and (p_max is null or sp.price_piasters <= p_max)
      and (not coalesce(p_sale, false) or sp.is_on_sale)
      and (not coalesce(p_new, false) or sp.is_new_arrival or sp.published_at > now() - interval '30 days')
      and (p_q is null or p_q = '' or sp.name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%'
           or sp.brand_name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
  )
  select to_jsonb(q.*) as product, count(*) over () as total_count
  from q
  order by
    case when p_sort = 'price_asc' then q.price_piasters end asc,
    case when p_sort = 'price_desc' then q.price_piasters end desc,
    case when p_sort = 'best_selling' then q.sold_count end desc,
    case when p_sort = 'newest' then q.published_at end desc,
    case when p_sort = 'recommended' or p_sort is null then q.is_featured end desc,
    case when p_sort = 'recommended' or p_sort is null then q.sold_count end desc,
    q.published_at desc, q.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.search_suggest(p_q text) returns jsonb
language sql stable set search_path = public as $$
  with t as (select replace(replace(trim(coalesce(p_q, '')), '%', ''), '_', '') as q)
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', s.slug, 'name', s.name, 'brand', s.brand_name,
        'price_piasters', s.price_piasters, 'image_url', s.image_url))
      from (
        select sp.* from public.storefront_products sp, t
        where char_length(t.q) >= 2 and (sp.name ilike '%' || t.q || '%' or sp.brand_name ilike '%' || t.q || '%')
        order by sp.sold_count desc, sp.published_at desc limit 6) s), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name))
      from (select br.* from public.brands br, t
            where br.is_active and char_length(t.q) >= 2 and br.name ilike '%' || t.q || '%'
            order by br.sort_order, br.name limit 4) b), '[]'::jsonb)
  );
$$;

-- ---------- order lifecycle ----------
create or replace function public._apply_status(
  p_order uuid, p_to public.order_status, p_actor uuid, p_actor_type text, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  allowed boolean;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'AKM_ORDER_NOT_FOUND'; end if;
  if o.status = p_to then return; end if;

  allowed := case o.status
    when 'pending_payment'      then p_to in ('awaiting_verification', 'paid', 'cancelled')
    when 'awaiting_verification' then p_to in ('paid', 'pending_payment', 'cancelled')
    when 'paid'                 then p_to in ('processing', 'cancelled', 'refunded')
    when 'processing'           then p_to in ('shipped', 'cancelled', 'refunded')
    when 'shipped'              then p_to in ('delivered', 'cancelled', 'refunded')
    when 'delivered'            then p_to in ('refunded')
    else false end;
  if not allowed then
    raise exception 'AKM_BAD_TRANSITION:% -> %', o.status, p_to;
  end if;

  -- cancelling returns stock and un-counts the sale
  if p_to = 'cancelled' then
    update public.product_variants v set stock = v.stock + i.qty
      from public.order_items i where i.order_id = o.id and i.variant_id = v.id;
    update public.products p set sold_count = greatest(p.sold_count - s.q, 0)
      from (select product_id, sum(qty)::int as q from public.order_items
            where order_id = o.id and product_id is not null group by product_id) s
      where p.id = s.product_id;
  end if;

  if p_to = 'paid' then
    update public.payments set status = 'succeeded' where order_id = o.id and status = 'pending';
  elsif p_to = 'delivered' and o.payment_method = 'cod' then
    update public.payments set status = 'succeeded' where order_id = o.id and status = 'pending';
  elsif p_to = 'refunded' then
    update public.payments set status = 'refunded' where order_id = o.id and status = 'succeeded';
  elsif p_to = 'cancelled' then
    update public.payments set status = 'failed' where order_id = o.id and status = 'pending';
  end if;

  update public.orders set status = p_to where id = o.id;
  insert into public.order_events (order_id, from_status, to_status, note, actor, actor_type)
  values (o.id, o.status, p_to, p_note, p_actor, p_actor_type);
end $$;

-- Admin-facing: authorization is enforced HERE, against admin_users.
create or replace function public.set_order_status(p_order uuid, p_to public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'AKM_FORBIDDEN'; end if;
  -- refunds move money: owner only
  if p_to = 'refunded' and not public.is_owner() then raise exception 'AKM_FORBIDDEN'; end if;
  perform public._apply_status(p_order, p_to, auth.uid(), 'admin', p_note);
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, detail)
  values (auth.uid(), (select email from public.admin_users where user_id = auth.uid()),
          'status', 'orders', p_order::text, jsonb_build_object('to', p_to, 'note', p_note));
end $$;

-- Server-only (service_role): payment webhooks, receipt upload, expiry job.
create or replace function public.system_set_order_status(
  p_order uuid, p_to public.order_status, p_note text default null, p_actor_type text default 'system'
) returns void language sql security definer set search_path = public as $$
  select public._apply_status(p_order, p_to, null, p_actor_type, p_note);
$$;

create or replace function public.expire_unpaid_orders(p_hours int default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  hrs int := coalesce(p_hours, public.setting_int('unpaid_order_expiry_hours', 24));
  r record;
  n int := 0;
begin
  for r in select id from public.orders
           where status = 'pending_payment' and created_at < now() - make_interval(hours => hrs)
           for update skip locked loop
    perform public._apply_status(r.id, 'cancelled', null, 'system', 'Expired: payment not received in time');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.attach_receipt(p_order uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'AKM_ORDER_NOT_FOUND'; end if;
  if o.payment_method <> 'instapay' or o.status not in ('pending_payment', 'awaiting_verification') then
    raise exception 'AKM_RECEIPT_NOT_ALLOWED';
  end if;
  insert into public.instapay_receipts (order_id, storage_path) values (p_order, p_path);
  perform public._apply_status(p_order, 'awaiting_verification', null, 'customer', 'InstaPay receipt uploaded');
end $$;

create or replace function public.review_receipt(p_receipt uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.instapay_receipts%rowtype;
begin
  if not public.is_admin() then raise exception 'AKM_FORBIDDEN'; end if;
  select * into r from public.instapay_receipts where id = p_receipt for update;
  if not found then raise exception 'AKM_NOT_FOUND'; end if;
  update public.instapay_receipts
    set status = case when p_approve then 'approved' else 'rejected' end::public.receipt_status,
        reviewed_by = auth.uid(), reviewed_at = now(), note = p_note
    where id = p_receipt;
  perform public._apply_status(r.order_id,
    case when p_approve then 'paid' else 'pending_payment' end::public.order_status,
    auth.uid(), 'admin', coalesce(p_note, case when p_approve then 'InstaPay payment verified' else 'InstaPay receipt rejected' end));
end $$;

-- ---------- cart pricing: ONE implementation shared by the quote endpoint and order creation ----------
-- p: { items:[{variant_id,qty}], coupon_code?, governorate_id? }
-- p_strict = true  (checkout): locks variants, raises on any problem.
-- p_strict = false (cart page): never raises on stock/coupon problems, reports them per line instead.
create or replace function public._price_cart(p jsonb, p_strict boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_zone public.shipping_zones%rowtype;
  v_cpn public.coupons%rowtype;
  v_code text := nullif(upper(trim(coalesce(p->>'coupon_code', ''))), '');
  v_cpn_err text;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_var record;
  v_stock int;
  v_issue text;
  v_unit int; v_orig int; v_pct int;
  v_subtotal bigint := 0; v_discount bigint := 0; v_shipping int;
  v_threshold int;
  v_free_ship boolean := false;
  v_low int := public.setting_int('low_stock_threshold', 0);
begin
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then
    if p_strict then raise exception 'AKM_EMPTY_CART'; end if;
    return jsonb_build_object('lines', '[]'::jsonb, 'subtotal', 0, 'discount', 0, 'shipping', null, 'total', 0,
      'coupon', null, 'coupon_error', null, 'free_shipping_threshold', public.setting_int('free_shipping_threshold_piasters', 0),
      'free_shipping_remaining', null, 'zone', null);
  end if;
  if jsonb_array_length(p->'items') > 30 then raise exception 'AKM_BAD_QTY:too_many_lines'; end if;

  if nullif(p->>'governorate_id', '') is not null then
    select * into v_zone from public.shipping_zones where id = (p->>'governorate_id')::uuid and is_active;
  end if;
  if p_strict and v_zone.id is null then raise exception 'AKM_BAD_GOVERNORATE'; end if;

  -- merge duplicate variants; ordered by id so concurrent checkouts lock in the same order (no deadlocks)
  for v_line in
    select (li->>'variant_id')::uuid as vid, sum((li->>'qty')::int)::int as qty
    from jsonb_array_elements(p->'items') li
    group by 1 order by 1
  loop
    if v_line.qty < 1 or v_line.qty > 10 then
      if p_strict then raise exception 'AKM_BAD_QTY:%', v_line.vid; end if;
      v_line.qty := least(greatest(v_line.qty, 1), 10);
    end if;
    v_issue := null;

    select v.id, v.sku, v.size, v.color, v.is_active,
           pr.id as product_id, pr.slug, pr.name, pr.status, pr.price_piasters, pr.compare_at_piasters,
           b.name as brand_name,
           (select url from public.product_images i where i.product_id = pr.id
              order by (i.color is not distinct from nullif(v.color, '')) desc, i.sort_order limit 1) as image_url
      into v_var
      from public.product_variants v
      join public.products pr on pr.id = v.product_id
      left join public.brands b on b.id = pr.brand_id
      where v.id = v_line.vid;

    if not found or not v_var.is_active or v_var.status <> 'published' then
      if p_strict then raise exception 'AKM_UNAVAILABLE:%', v_line.vid; end if;
      v_lines := v_lines || jsonb_build_object('variant_id', v_line.vid, 'qty', v_line.qty, 'issue', 'unavailable');
      continue;
    end if;

    if p_strict then
      perform 1 from public.product_variants where id = v_line.vid for update;
    end if;
    select stock into v_stock from public.product_variants where id = v_line.vid; -- re-read after the lock
    if v_stock < v_line.qty then
      if p_strict then raise exception 'AKM_OUT_OF_STOCK:%:%', v_line.vid, v_stock; end if;
      v_issue := case when v_stock = 0 then 'out_of_stock' else 'limited_stock' end;
    end if;

    v_pct := public.active_offer_percent(v_var.product_id);
    v_unit := public.apply_percent(v_var.price_piasters, v_pct);
    v_orig := coalesce(v_var.compare_at_piasters, v_var.price_piasters);
    if v_issue is null then v_subtotal := v_subtotal + v_unit::bigint * v_line.qty; end if;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_var.id, 'product_id', v_var.product_id, 'slug', v_var.slug, 'name', v_var.name,
      'brand', v_var.brand_name, 'sku', v_var.sku, 'size', v_var.size, 'color', v_var.color,
      'image_url', v_var.image_url, 'unit', v_unit, 'orig', v_orig, 'qty', v_line.qty,
      'issue', v_issue,
      -- exact numbers are only revealed when the request cannot be met, or stock is at/below the owner's threshold
      'max_qty', case when v_issue is not null then v_stock end,
      'stock_left', case when v_stock > 0 and v_stock <= v_low then v_stock end);
  end loop;

  -- coupon (strict: lock the row and raise; quote: report the reason)
  if v_code is not null then
    if p_strict then select * into v_cpn from public.coupons where code = v_code for update;
    else select * into v_cpn from public.coupons where code = v_code; end if;
    if not found or not v_cpn.is_active
       or (v_cpn.starts_at is not null and v_cpn.starts_at > now())
       or (v_cpn.expires_at is not null and v_cpn.expires_at <= now()) then
      v_cpn_err := 'unavailable';
    elsif v_cpn.max_uses is not null and v_cpn.used_count >= v_cpn.max_uses then
      v_cpn_err := 'used_up';
    elsif v_subtotal < v_cpn.min_subtotal_piasters then
      v_cpn_err := 'min_subtotal:' || v_cpn.min_subtotal_piasters;
    end if;
    if v_cpn_err is not null then
      if p_strict then raise exception 'AKM_COUPON_INVALID:%', v_cpn_err; end if;
    elsif v_cpn.type = 'percent' then v_discount := (v_subtotal * v_cpn.value) / 100;
    elsif v_cpn.type = 'fixed' then v_discount := least(v_cpn.value::bigint, v_subtotal);
    else v_free_ship := true; end if;
  end if;

  v_threshold := public.setting_int('free_shipping_threshold_piasters', 0);
  if v_zone.id is not null then
    v_shipping := v_zone.fee_piasters;
    if v_free_ship or (v_threshold > 0 and (v_subtotal - v_discount) >= v_threshold) then v_shipping := 0; end if;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal, 'discount', v_discount, 'shipping', v_shipping,
    'total', v_subtotal - v_discount + coalesce(v_shipping, 0),
    'coupon', case when v_code is not null and v_cpn_err is null then jsonb_build_object('code', v_code, 'type', v_cpn.type) end,
    'coupon_error', v_cpn_err,
    'free_shipping_threshold', v_threshold,
    'free_shipping_remaining', case when v_threshold > 0 and not v_free_ship and (v_subtotal - v_discount) < v_threshold
                                    then v_threshold - (v_subtotal - v_discount) end,
    'zone', case when v_zone.id is not null then jsonb_build_object('id', v_zone.id, 'name', v_zone.governorate) end);
end $$;

-- Read-only quote for the cart page (service_role only; wrapped by a rate-limited endpoint).
create or replace function public.quote_cart(p jsonb) returns jsonb
language sql security definer set search_path = public as $$
  select public._price_cart(p, false);
$$;

-- ---------- order creation (the only way an order is created) ----------
-- Everything is recomputed from the database. The client only supplies variant ids, quantities,
-- address, payment method and coupon code.
create or replace function public.create_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_key uuid := (p->>'idempotency_key')::uuid;
  v_pay public.payment_method := (p->>'payment_method')::public.payment_method;
  v_existing public.orders%rowtype;
  v_enabled jsonb;
  v_q jsonb;
  v_status public.order_status;
  v_oid uuid; v_num text;
  v_code text;
  v_card_provider text := nullif(p->>'card_provider', '');
begin
  -- serialize concurrent submissions of the same key; the second one then sees the first's order
  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
      'status', v_existing.status, 'total_piasters', v_existing.total_piasters,
      'payment_method', v_existing.payment_method, 'replayed', true);
  end if;

  select value into v_enabled from public.settings where key = 'payment_methods_enabled';
  if coalesce((v_enabled ->> v_pay::text)::boolean, false) is not true then
    raise exception 'AKM_PAYMENT_DISABLED';
  end if;

  v_q := public._price_cart(p, true);  -- raises on anything wrong
  v_code := v_q #>> '{coupon,code}';
  v_status := case v_pay when 'cod' then 'processing' else 'pending_payment' end::public.order_status;

  begin
    insert into public.orders (
      status, payment_method, idempotency_key, customer_name, phone, governorate_id, governorate,
      city, area, address, landmark, notes,
      subtotal_piasters, discount_piasters, shipping_piasters, total_piasters, coupon_code)
    values (
      v_status, v_pay, v_key, trim(p->>'customer_name'), p->>'phone',
      (v_q #>> '{zone,id}')::uuid, v_q #>> '{zone,name}',
      trim(p->>'city'), trim(p->>'area'), trim(p->>'address'), trim(p->>'landmark'),
      nullif(trim(coalesce(p->>'notes', '')), ''),
      (v_q->>'subtotal')::int, (v_q->>'discount')::int, (v_q->>'shipping')::int, (v_q->>'total')::int, v_code)
    returning id, order_number into v_oid, v_num;
  exception when unique_violation then
    raise exception 'AKM_RETRY'; -- vanishingly rare order_number collision; caller retries with the same key
  end;

  insert into public.order_items (
    order_id, variant_id, product_id, product_name, brand_name, sku, size, color, image_url,
    unit_price_piasters, original_unit_price_piasters, qty, line_total_piasters)
  select v_oid, (l->>'variant_id')::uuid, (l->>'product_id')::uuid, l->>'name', l->>'brand',
         l->>'sku', l->>'size', l->>'color', l->>'image_url',
         (l->>'unit')::int, (l->>'orig')::int, (l->>'qty')::int, (l->>'unit')::int * (l->>'qty')::int
  from jsonb_array_elements(v_q->'lines') l;

  update public.product_variants v set stock = v.stock - (l->>'qty')::int
    from jsonb_array_elements(v_q->'lines') l where v.id = (l->>'variant_id')::uuid;
  update public.products pr set sold_count = pr.sold_count + s.q
    from (select (l->>'product_id')::uuid as pid, sum((l->>'qty')::int)::int as q
          from jsonb_array_elements(v_q->'lines') l group by 1) s where pr.id = s.pid;
  if v_code is not null then update public.coupons set used_count = used_count + 1 where code = v_code; end if;

  insert into public.payments (order_id, provider, amount_piasters, status)
  values (v_oid,
          case v_pay when 'cod' then 'cod' when 'instapay' then 'instapay' else coalesce(v_card_provider, 'paymob') end,
          (v_q->>'total')::int, 'pending');

  insert into public.order_events (order_id, from_status, to_status, note, actor_type)
  values (v_oid, null, v_status,
          case v_pay when 'cod' then 'Order placed — cash on delivery'
                     when 'instapay' then 'Order placed — awaiting InstaPay transfer'
                     else 'Order placed — awaiting card payment' end, 'customer');

  return jsonb_build_object('order_id', v_oid, 'order_number', v_num, 'status', v_status,
    'total_piasters', (v_q->>'total')::int, 'subtotal_piasters', (v_q->>'subtotal')::int,
    'discount_piasters', (v_q->>'discount')::int, 'shipping_piasters', (v_q->>'shipping')::int,
    'payment_method', v_pay, 'replayed', false);
end $$;

-- Public tracking: needs BOTH order number and phone; returns no name, phone or street address.
create or replace function public.track_order(p_number text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where order_number = upper(p_number) and phone = p_phone;
  if not found then return null; end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'status', o.status, 'payment_method', o.payment_method,
    'created_at', o.created_at, 'governorate', o.governorate,
    'subtotal_piasters', o.subtotal_piasters, 'discount_piasters', o.discount_piasters,
    'shipping_piasters', o.shipping_piasters, 'total_piasters', o.total_piasters,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'name', i.product_name, 'brand', i.brand_name, 'size', i.size, 'color', i.color,
        'qty', i.qty, 'unit_price_piasters', i.unit_price_piasters, 'image_url', i.image_url) order by i.id)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at, 'note', null) order by e.id)
      from public.order_events e where e.order_id = o.id), '[]'::jsonb));
end $$;

-- Owner-only: remove all demo catalog data before launch.
create or replace function public.delete_demo_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare np int; nb int; nc int;
begin
  if not public.is_owner() then raise exception 'AKM_FORBIDDEN'; end if;
  delete from public.products where is_demo; get diagnostics np = row_count;
  delete from public.brands where is_demo; get diagnostics nb = row_count;
  delete from public.categories where is_demo; get diagnostics nc = row_count;
  return jsonb_build_object('products', np, 'brands', nb, 'categories', nc);
end $$;
