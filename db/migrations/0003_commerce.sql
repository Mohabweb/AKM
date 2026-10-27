-- 0003_commerce.sql — orders, order_items, payments, instapay_receipts, order_events

-- Public order number like AKM-7K3Q9F. Alphabet excludes I, L, O, U to avoid look-alikes.
create or replace function public.gen_order_number() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  out text := 'AKM-';
  i int;
begin
  bytes := gen_random_bytes(6);
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.gen_order_number(),
  status public.order_status not null,
  payment_method public.payment_method not null,
  idempotency_key uuid not null unique,

  customer_name text not null,
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  governorate_id uuid references public.shipping_zones(id) on delete set null,
  governorate text not null,
  city text not null,
  area text not null,
  address text not null,
  landmark text not null,
  notes text,

  subtotal_piasters int not null check (subtotal_piasters >= 0),
  discount_piasters int not null default 0 check (discount_piasters >= 0),
  shipping_piasters int not null check (shipping_piasters >= 0),
  total_piasters int not null check (total_piasters >= 0),
  coupon_code text,
  currency text not null default 'EGP' check (currency = 'EGP'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_piasters = subtotal_piasters - discount_piasters + shipping_piasters)
);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (phone);
create index orders_created_idx on public.orders (created_at desc);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- Nullable + set null so deleting a product never rewrites history; the snapshot below is the record.
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  brand_name text,
  sku text not null,
  size text not null,
  color text not null default '',
  image_url text,
  unit_price_piasters int not null check (unit_price_piasters >= 0),
  original_unit_price_piasters int not null check (original_unit_price_piasters >= 0),
  qty int not null check (qty between 1 and 10),
  line_total_piasters int not null check (line_total_piasters >= 0),
  check (line_total_piasters = unit_price_piasters * qty)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('paymob', 'kashier', 'instapay', 'cod')),
  provider_ref text,
  amount_piasters int not null check (amount_piasters >= 0),
  status public.payment_status not null default 'pending',
  -- sanitized provider callback payload (no card data is ever received by this app)
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_ref_uidx on public.payments (provider, provider_ref) where provider_ref is not null;
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.instapay_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- path inside the PRIVATE 'instapay-receipts' bucket (never a public URL)
  storage_path text not null,
  status public.receipt_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  note text,
  uploaded_at timestamptz not null default now()
);
create index instapay_receipts_order_idx on public.instapay_receipts (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  note text,
  actor uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system' check (actor_type in ('system', 'customer', 'admin', 'webhook')),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);
