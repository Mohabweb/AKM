import { parseEGP } from "@/lib/money";
import { SORTS, type ShopQuery, type Sort } from "@/lib/catalog";

export type RawParams = Record<string, string | string[] | undefined>;
const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** URL → validated query. Anything malformed is dropped, never passed to the database. */
export function parseShopParams(p: RawParams): ShopQuery & { page: number; sort: Sort } {
  const sort = SORTS.includes(one(p.sort) as Sort) ? (one(p.sort) as Sort) : "recommended";
  const page = Math.min(Math.max(parseInt(one(p.page) ?? "1", 10) || 1, 1), 500);
  const min = one(p.min) ? parseEGP(one(p.min)!) : null;
  const max = one(p.max) ? parseEGP(one(p.max)!) : null;
  return {
    brands: arr(p.brand).filter((b) => slug.test(b)).slice(0, 10),
    sizes: arr(p.size).filter((s) => /^[0-9]{1,2}(\.5)?$/.test(s)).slice(0, 12),
    min: min ?? undefined, max: max ?? undefined,
    sale: one(p.sale) === "1", isNew: one(p.new) === "1",
    q: one(p.q)?.trim().slice(0, 60) || undefined,
    sort, page,
  };
}

export function buildShopHref(base: string, q: ShopQuery, page: number): string {
  const u = new URLSearchParams();
  q.brands?.forEach((b) => u.append("brand", b));
  q.sizes?.forEach((s) => u.append("size", s));
  if (q.min != null) u.set("min", String(q.min / 100));
  if (q.max != null) u.set("max", String(q.max / 100));
  if (q.sale) u.set("sale", "1");
  if (q.isNew) u.set("new", "1");
  if (q.q) u.set("q", q.q);
  if (q.sort && q.sort !== "recommended") u.set("sort", q.sort);
  if (page > 1) u.set("page", String(page));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export const hasFilters = (q: ShopQuery) => !!(q.brands?.length || q.sizes?.length || q.min != null || q.max != null || q.sale || q.isNew);

import type { Metadata } from "next";
/** Filtered / searched views are noindex (duplicate content); plain listing pages are indexable with a self canonical. */
export function listingMeta(base: string, params: RawParams, title: string, description?: string): Metadata {
  const q = parseShopParams(params);
  const noindex = hasFilters(q) || !!q.q || q.sort !== "recommended";
  return {
    title, description,
    alternates: { canonical: q.page > 1 ? `${base}?page=${q.page}` : base },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}
