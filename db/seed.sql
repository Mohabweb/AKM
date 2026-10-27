-- db/seed.sql — idempotent. Safe to re-run.
-- Contains: default settings, governorates, store categories, homepage layout, SIX DEMO PRODUCTS (is_demo = true).
-- No real catalog, brands or prices are imported. Remove demo data before launch: Admin → Settings → "Delete demo data"
-- or `select public.delete_demo_data();` as the owner.

-- ---------- settings ----------
insert into public.settings (key, value, is_public, description) values
  ('store_name',            '"AKM Luxury Shoes"', true,  'Store name'),
  ('store_address',         '"484 Horreya Road, next to Lisabella, opposite Bokla tram station"', true, 'Street address shown in footer'),
  ('store_postal_code',     '"20220"', true, 'Postal code'),
  ('social_instagram',      '"https://www.instagram.com/akm_egy"', true, 'Instagram URL'),
  ('social_tiktok',         '"https://www.tiktok.com/@akm_store1"', true, 'TikTok URL'),
  ('social_facebook',       '"https://www.facebook.com/share/1DMt6k4yF2/"', true, 'Facebook URL'),
  ('whatsapp_number',       '""', true, 'WhatsApp business number in international format without + (e.g. 20XXXXXXXXXX). Empty = WhatsApp ordering hidden.'),
  ('contact_phone',         '""', true, 'Public phone number'),
  ('contact_email',         '""', true, 'Public contact email'),
  ('instapay_number',       '"01200756172"', true, 'InstaPay number customers transfer to'),
  ('instapay_account_name', '""', true, 'Name shown on the InstaPay account (optional)'),
  ('announcement_enabled',  'true', true, 'Show the announcement bar'),
  ('announcement_text',     '"New styles added regularly — follow @akm_egy on Instagram"', true, 'Announcement bar text'),
  ('announcement_href',     '""', true, 'Optional link for the announcement bar'),
  ('free_shipping_threshold_piasters', '0', true, 'Free shipping when discounted subtotal reaches this amount (piasters). 0 = disabled.'),
  ('low_stock_threshold',   '3', true, 'Show "N left" only when real stock is at or below this number. 0 = never show.'),
  ('payment_methods_enabled', '{"cod": true, "card": false, "instapay": true}', true, 'Which payment methods checkout offers. Enable card only after configuring Paymob/Kashier.'),
  ('unpaid_order_expiry_hours', '24', false, 'Unpaid card/InstaPay orders are cancelled and restocked after this many hours.'),
  ('shipping_fees_reviewed','false', false, 'Owner confirms shipping fees were reviewed (dashboard warning until true).'),
  ('policy_delivery',       '"Delivery fee is calculated at checkout from your governorate."', true, 'Delivery text'),
  ('policy_returns',        '"The returns and exchange policy has not been published yet. Please contact the store before ordering."', true, 'Returns text — owner must replace before launch'),
  ('policy_privacy',        '"We collect your name, phone number and delivery address only to process and deliver your order and to contact you about it. We do not sell your data. InstaPay receipt images are stored privately and visible only to store staff. Card details are entered on the payment provider''s page and never reach our servers."', true, 'Privacy policy text'),
  ('policy_terms',          '"The terms of sale have not been published yet."', true, 'Terms text — owner must replace before launch')
on conflict (key) do nothing;

-- ---------- governorates (placeholder fee EGP 60 — owner must review) ----------
insert into public.shipping_zones (governorate, fee_piasters, sort_order)
select g, 6000, row_number() over ()
from unnest(array[
  'Cairo','Giza','Alexandria','Qalyubia','Port Said','Suez','Dakahlia','Sharqia','Gharbia','Monufia',
  'Beheira','Kafr El Sheikh','Damietta','Ismailia','Fayoum','Beni Suef','Minya','Asyut','Sohag','Qena',
  'Luxor','Aswan','Red Sea','Matrouh','North Sinai','South Sinai','New Valley'
]) as g
on conflict (governorate) do nothing;

-- ---------- store categories (from the business description; no products attached) ----------
insert into public.categories (name, slug, sort_order) values
  ('Sneakers', 'sneakers', 1),
  ('Casual Shoes', 'casual-shoes', 2),
  ('Sports & Running', 'sports-running', 3),
  ('Fashion & Luxury', 'fashion-luxury', 4),
  ('Slides & Slippers', 'slides-slippers', 5),
  ('Ballet Flats', 'ballet-flats', 6),
  ('Heels', 'heels', 7),
  ('Boots', 'boots', 8)
on conflict (slug) do nothing;

-- ---------- demo catalog ----------
insert into public.brands (name, slug, is_demo, sort_order) values ('Demo Brand', 'demo-brand', true, 99)
on conflict (slug) do nothing;

with b as (select id from public.brands where slug = 'demo-brand')
insert into public.products (brand_id, name, slug, description, price_piasters, compare_at_piasters, status, is_demo, is_new_arrival, is_featured)
select b.id, v.name, v.slug, 'DEMO PRODUCT — placeholder for testing. Delete before launch.', v.price, v.compare, 'published', true, v.is_new, v.featured
from b, (values
  ('Demo Sneaker 1', 'demo-sneaker-1', 100000, 140000, true,  true),
  ('Demo Sneaker 2', 'demo-sneaker-2', 120000, null,   true,  false),
  ('Demo Slide 3',   'demo-slide-3',    60000,  80000, false, false),
  ('Demo Boot 4',    'demo-boot-4',    180000, 220000, false, true),
  ('Demo Flat 5',    'demo-flat-5',     90000, null,   true,  false),
  ('Demo Runner 6',  'demo-runner-6',  150000, 190000, false, false)
) as v(name, slug, price, compare, is_new, featured)
on conflict (slug) do nothing;

-- variants: sizes per spec; Demo Sneaker 1 has two colours; one size sold out and one at low stock to exercise the UI
insert into public.product_variants (product_id, sku, size, color, stock)
select p.id,
       'DEMO-' || upper(regexp_replace(p.slug, '^demo-', '')) || '-' || s.size || case when c.color = '' then '' else '-' || upper(left(c.color, 3)) end,
       s.size::text, c.color,
       case when p.slug = 'demo-sneaker-1' and s.size = 41 and c.color = 'White' then 0
            when p.slug = 'demo-sneaker-1' and s.size = 42 and c.color = 'White' then 2
            else 6 end
from public.products p
join (values
  ('demo-sneaker-1', 40, 43), ('demo-sneaker-2', 39, 42), ('demo-slide-3', 40, 44),
  ('demo-boot-4', 38, 41), ('demo-flat-5', 36, 39), ('demo-runner-6', 40, 43)
) r(slug, lo, hi) on r.slug = p.slug
cross join lateral generate_series(r.lo, r.hi) as s(size)
cross join lateral (
  select unnest(case when p.slug = 'demo-sneaker-1' then array['White', 'Black'] else array[''] end) as color
) c
where p.is_demo
on conflict (sku) do nothing;

-- images (generated by scripts/gen-demo-images.ts into public/demo)
insert into public.product_images (product_id, url, alt, sort_order)
select p.id, '/demo/' || p.slug || '-' || t.suffix || '.webp', p.name || ' (demo image)', t.ord
from public.products p
cross join (values ('a', 0), ('b', 1)) t(suffix, ord)
where p.is_demo
  and not exists (select 1 from public.product_images i where i.product_id = p.id);

-- categories for demo products
insert into public.product_categories (product_id, category_id)
select p.id, c.id from public.products p join public.categories c on c.slug = case p.slug
  when 'demo-sneaker-1' then 'sneakers' when 'demo-sneaker-2' then 'sneakers'
  when 'demo-slide-3' then 'slides-slippers' when 'demo-boot-4' then 'boots'
  when 'demo-flat-5' then 'ballet-flats' when 'demo-runner-6' then 'sports-running' end
where p.is_demo
on conflict do nothing;

-- ---------- default homepage layout (owner edits in admin) ----------
insert into public.homepage_sections (type, title, subtitle, source, config, sort_order)
select * from (values
  ('hero',            'Walk in luxury', 'Sneakers, heels, boots and more — from Alexandria to your door.', null::text,
     '{"cta_label":"Shop new arrivals","cta_href":"/shop?new=1","secondary_label":"Browse categories","secondary_href":"/shop"}'::jsonb, 10),
  ('marquee',         null, null, null, '{"items":["AKM Luxury Shoes","Sneakers","Heels","Boots","Slides","Ballet Flats"]}'::jsonb, 20),
  ('product_row',     'New Arrivals', 'Just landed', 'new_arrivals', '{"href":"/shop?new=1"}'::jsonb, 30),
  ('category_tiles',  'Shop by category', null, null, '{}'::jsonb, 40),
  ('product_row',     'Best Sellers', 'What everyone is ordering', 'best_sellers', '{"href":"/shop?sort=best_selling"}'::jsonb, 50),
  ('brand_row',       'Shop by brand', null, null, '{}'::jsonb, 60),
  ('product_row',     'Trending', null, 'featured', '{"href":"/shop"}'::jsonb, 70),
  ('product_row',     'On sale', null, 'sale', '{"href":"/shop?sale=1"}'::jsonb, 80),
  ('trust_bar',       null, null, null, '{}'::jsonb, 90),
  ('payment_methods', 'Ways to pay', null, null, '{}'::jsonb, 100)
) v(type, title, subtitle, source, config, sort_order)
where not exists (select 1 from public.homepage_sections);
