import type { MetadataRoute } from "next";
import { getBrands, getCategories, getSitemapProducts } from "@/lib/catalog";
import { abs } from "@/lib/site";
import { LEGAL_SLUGS } from "@/lib/legal";

/** Only indexable pages. Cart, checkout, order, track, search, wishlist and admin are deliberately absent. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cats, brands, products] = await Promise.all([getCategories(), getBrands(), getSitemapProducts()]);
  return [
    { url: abs("/"), changeFrequency: "daily", priority: 1 },
    { url: abs("/shop"), changeFrequency: "daily", priority: 0.9 },
    ...cats.map((c) => ({ url: abs(`/category/${c.slug}`), changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: abs(`/brand/${b.slug}`), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: abs(`/product/${p.slug}`), lastModified: p.updated_at ? new Date(p.updated_at) : undefined, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...LEGAL_SLUGS.map((s) => ({ url: abs(`/${s}`), changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
