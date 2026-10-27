import { cacheLife, cacheTag } from "next/cache";
import { anonClient } from "@/lib/supabase/anon";

/** Public storefront reads. Everything here runs as the `anon` role, so RLS is the only gate. */

export type ProductCardData = {
  id: string; slug: string; name: string; description: string | null;
  brand_id: string | null; brand_name: string | null; brand_slug: string | null;
  price_piasters: number; original_price_piasters: number; is_on_sale: boolean;
  is_new_arrival: boolean; is_featured: boolean; sold_count: number; published_at: string | null;
  is_demo: boolean; image_url: string | null; image2_url: string | null; in_stock: boolean;
};
export type Variant = { id: string; product_id: string; size: string; color: string; in_stock: boolean; stock_left: number | null };
export type Category = { id: string; parent_id: string | null; name: string; slug: string; kind: string; description: string | null; image_url: string | null };
export type Brand = { id: string; name: string; slug: string; logo_url: string | null };
export type Settings = Record<string, unknown>;

export const PAGE_SIZE = 24;
export const SORTS = ["recommended", "newest", "best_selling", "price_asc", "price_desc"] as const;
export type Sort = (typeof SORTS)[number];
export type ShopQuery = {
  brands?: string[]; category?: string; sizes?: string[]; min?: number; max?: number;
  sale?: boolean; isNew?: boolean; q?: string; sort?: Sort; page?: number;
};

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("minutes");
  cacheTag("settings");
  const { data } = await anonClient().from("settings").select("key,value").eq("is_public", true);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}
export const str = (s: Settings, k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const { data } = await anonClient().from("categories").select("id,parent_id,name,slug,kind,description,image_url").order("sort_order").order("name");
  return (data ?? []) as Category[];
}

export async function getBrands(): Promise<Brand[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const { data } = await anonClient().from("brands").select("id,name,slug,logo_url").order("sort_order").order("name");
  return (data ?? []) as Brand[];
}

export async function shopProducts(q: ShopQuery): Promise<{ products: ProductCardData[]; total: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const page = Math.max(1, Math.floor(q.page ?? 1));
  const { data, error } = await anonClient().rpc("shop_products", {
    p_brands: q.brands?.length ? q.brands : null,
    p_category: q.category ?? null,
    p_sizes: q.sizes?.length ? q.sizes : null,
    p_min: q.min ?? null,
    p_max: q.max ?? null,
    p_sale: q.sale ?? false,
    p_new: q.isNew ?? false,
    p_q: q.q ?? null,
    p_sort: q.sort ?? "recommended",
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
 if (error) throw new Error("shop_products failed: " + error.code + " " + error.message);
  const rows = (data ?? []) as { product: ProductCardData; total_count: number }[];
  return { products: rows.map((r) => r.product), total: Number(rows[0]?.total_count ?? 0) };
}

export type ProductDetail = ProductCardData & {
  images: { url: string; alt: string | null; color: string | null }[];
  categories: { id: string; name: string; slug: string }[];
  meta: { title: string | null; description: string | null };
};

export async function getProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `product:${slug}`);
  const sb = anonClient();
  const { data: p } = await sb.from("storefront_products").select("*").eq("slug", slug).maybeSingle();
  if (!p) return null;
  const [imgs, cats] = await Promise.all([
    sb.from("product_images").select("url,alt,color").eq("product_id", p.id).order("sort_order").order("created_at"),
    sb.from("product_categories").select("categories(id,name,slug)").eq("product_id", p.id),
  ]);
  const categories = ((cats.data ?? []) as unknown as { categories: { id: string; name: string; slug: string } | null }[])
    .map((r) => r.categories).filter((c): c is { id: string; name: string; slug: string } => !!c);
  return { ...(p as ProductCardData), images: imgs.data ?? [], categories, meta: { title: null, description: null } };
}

/** NOT cached: stock changes with every order, and the product page must show it live. */
export async function getVariants(productId: string): Promise<Variant[]> {
  const { data } = await anonClient().from("public_variants").select("id,product_id,size,color,in_stock,stock_left").eq("product_id", productId);
  const rows = (data ?? []) as Variant[];
  return rows.sort((a, b) => (Number(a.size) - Number(b.size)) || a.size.localeCompare(b.size) || a.color.localeCompare(b.color));
}

export async function getRelated(product: { id: string; brand_slug: string | null }, categorySlug: string | null): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const { products } = await shopProducts_uncached({ category: categorySlug ?? undefined, brands: !categorySlug && product.brand_slug ? [product.brand_slug] : undefined });
  return products.filter((p) => p.id !== product.id).slice(0, 8);
}
async function shopProducts_uncached(q: ShopQuery) {
  const { data } = await anonClient().rpc("shop_products", {
    p_brands: q.brands ?? null, p_category: q.category ?? null, p_sizes: null, p_min: null, p_max: null,
    p_sale: false, p_new: false, p_q: null, p_sort: "best_selling", p_limit: 9, p_offset: 0,
  });
  const rows = (data ?? []) as { product: ProductCardData }[];
  return { products: rows.map((r) => r.product) };
}

export async function getProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  const safe = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 24);
  if (!safe.length) return [];
  const { data } = await anonClient().from("storefront_products").select("*").in("id", safe);
  const byId = new Map(((data ?? []) as ProductCardData[]).map((p) => [p.id, p]));
  return safe.map((i) => byId.get(i)).filter((p): p is ProductCardData => !!p);
}

export type HomeSection = {
  id: string; type: string; title: string | null; subtitle: string | null; source: string | null;
  config: Record<string, unknown>; products: ProductCardData[]; categories?: Category[]; brands?: Brand[];
};

/** Admin-driven homepage. Sections with nothing to show are dropped here, so the page never renders an empty block. */
export async function getHomepage(): Promise<HomeSection[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "homepage");
  const sb = anonClient();
  const { data: sections } = await sb.from("homepage_sections").select("*").order("sort_order");
  const [cats, brands] = await Promise.all([getCategories(), getBrands()]);
  const out: HomeSection[] = [];
  for (const s of sections ?? []) {
    let products: ProductCardData[] = [];
    if (s.type === "product_row") {
      if (s.source === "manual") {
        const { data } = await sb.from("storefront_products").select("*").in("id", s.product_ids ?? []);
        const by = new Map(((data ?? []) as ProductCardData[]).map((p) => [p.id, p]));
        products = (s.product_ids as string[]).map((i) => by.get(i)).filter((p): p is ProductCardData => !!p);
      } else {
        const sort = s.source === "best_sellers" ? "best_selling" : s.source === "new_arrivals" ? "newest" : "recommended";
        const cat = s.source === "category" ? cats.find((c) => c.id === s.category_id)?.slug : undefined;
        const { data } = await sb.rpc("shop_products", {
          p_brands: null, p_category: cat ?? null, p_sizes: null, p_min: null, p_max: null,
          p_sale: s.source === "sale", p_new: s.source === "new_arrivals", p_q: null, p_sort: sort, p_limit: 8, p_offset: 0,
        });
        products = ((data ?? []) as { product: ProductCardData }[]).map((r) => r.product);
        if (s.source === "best_sellers") products = products.filter((p) => p.sold_count > 0).length ? products.filter((p) => p.sold_count > 0) : [];
        if (s.source === "featured") products = products.filter((p) => p.is_featured);
      }
      if (!products.length) continue;
    }
    if (s.type === "category_tiles" && !cats.filter((c) => !c.parent_id).length) continue;
    if (s.type === "brand_row" && !brands.length) continue;
    out.push({
      id: s.id, type: s.type, title: s.title, subtitle: s.subtitle, source: s.source,
      config: (s.config ?? {}) as Record<string, unknown>, products,
      categories: s.type === "category_tiles" ? cats.filter((c) => !c.parent_id) : undefined,
      brands: s.type === "brand_row" ? brands : undefined,
    });
  }
  return out;
}

export type SitemapEntry = { slug: string; updated_at: string | null };
export async function getSitemapProducts(): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data } = await anonClient().from("storefront_products").select("slug,published_at");
  return (data ?? []).map((r) => ({ slug: r.slug, updated_at: r.published_at }));
}

export async function getSizes(): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const { data } = await anonClient().from("public_variants").select("size").eq("in_stock", true);
  const set = new Set((data ?? []).map((r) => r.size as string));
  return [...set].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

export type Zone = { id: string; governorate: string; fee_piasters: number };
export async function getShippingZones(): Promise<Zone[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("shipping");
  const { data } = await anonClient().from("shipping_zones").select("id,governorate,fee_piasters").order("sort_order").order("governorate");
  return (data ?? []) as Zone[];
}
