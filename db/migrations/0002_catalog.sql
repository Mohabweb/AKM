-- 0002_catalog.sql — brands, categories, products, images, variants, homepage, offers, coupons, shipping

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind public.category_kind not null default 'category',
  description text,
  image_url text,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categories_parent_idx on public.categories (parent_id);
create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  -- integer piasters (EGP * 100)
  price_piasters int not null check (price_piasters >= 0),
  compare_at_piasters int check (compare_at_piasters is null or compare_at_piasters > price_piasters),
  status public.product_status not null default 'draft',
  is_demo boolean not null default false,
  is_new_arrival boolean not null default false,
  is_featured boolean not null default false,
  sold_count int not null default 0 check (sold_count >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products (status, published_at desc);
create index products_brand_idx on public.products (brand_id);
create index products_name_trgm on public.products using gin (name gin_trgm_ops);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create or replace function public.products_set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  return new;
end $$;
create trigger products_published_at before insert or update on public.products
  for each row execute function public.products_set_published_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique check (char_length(sku) between 1 and 60),
  size text not null check (char_length(size) between 1 and 12),
  color text not null default '' check (char_length(color) <= 40),
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);
create index product_categories_cat_idx on public.product_categories (category_id);

-- ---------- homepage ----------
create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('hero', 'product_row', 'category_tiles', 'brand_row', 'marquee', 'promo_banner', 'trust_bar', 'payment_methods')),
  title text,
  subtitle text,
  -- for product_row: new_arrivals | best_sellers | trending | featured | sale | category | manual
  source text check (source in ('new_arrivals', 'best_sellers', 'trending', 'featured', 'sale', 'category', 'manual')),
  category_id uuid references public.categories(id) on delete set null,
  product_ids uuid[] not null default '{}',
  -- free-form, validated by the app per type (cta label/url, image_url, marquee items ...)
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger homepage_touch before update on public.homepage_sections for each row execute function public.touch_updated_at();

-- ---------- offers (automatic percentage discounts) ----------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  banner_text text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger offers_touch before update on public.offers for each row execute function public.touch_updated_at();

create table public.offer_rules (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  scope public.discount_scope not null,
  target_id uuid,
  percent_off int not null check (percent_off between 1 and 90),
  check ((scope = 'all' and target_id is null) or (scope <> 'all' and target_id is not null))
);
create index offer_rules_offer_idx on public.offer_rules (offer_id);

-- ---------- coupons ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,40}$'),
  type public.coupon_type not null,
  -- percent: 1..100 ; fixed: piasters ; free_shipping: ignored (0)
  value int not null default 0 check (value >= 0),
  min_subtotal_piasters int not null default 0 check (min_subtotal_piasters >= 0),
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percent' or value between 1 and 100),
  check (type <> 'fixed' or value > 0)
);
create trigger coupons_touch before update on public.coupons for each row execute function public.touch_updated_at();

-- ---------- shipping ----------
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null unique,
  fee_piasters int not null check (fee_piasters >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger shipping_touch before update on public.shipping_zones for each row execute function public.touch_updated_at();

-- ---------- audit triggers on admin-managed tables ----------
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_trigger();
create trigger audit_variants after insert or update or delete on public.product_variants for each row execute function public.audit_trigger();
create trigger audit_brands after insert or update or delete on public.brands for each row execute function public.audit_trigger();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.audit_trigger();
create trigger audit_homepage after insert or update or delete on public.homepage_sections for each row execute function public.audit_trigger();
create trigger audit_offers after insert or update or delete on public.offers for each row execute function public.audit_trigger();
create trigger audit_offer_rules after insert or update or delete on public.offer_rules for each row execute function public.audit_trigger();
create trigger audit_coupons after insert or update or delete on public.coupons for each row execute function public.audit_trigger();
create trigger audit_shipping after insert or update or delete on public.shipping_zones for each row execute function public.audit_trigger();
create trigger audit_settings after insert or update or delete on public.settings for each row execute function public.audit_trigger();
create trigger audit_admin_users after insert or update or delete on public.admin_users for each row execute function public.audit_trigger();
