"use client";
import { useEffect, useState } from "react";
import { useRecent, useWishlist } from "@/lib/client/lists";
import { ProductGrid } from "./ProductCard";
import type { ProductCardData } from "@/lib/catalog";

/** Client-fetched lists of products saved in this browser (recently viewed / wishlist). */
export function SavedProducts({ source, exclude, limit = 8, title }: { source: "recent" | "wishlist"; exclude?: string; limit?: number; title?: string }) {
  const recent = useRecent(), wish = useWishlist();
  const ids = (source === "recent" ? recent : wish).filter((i) => i !== exclude).slice(0, limit);
  const key = ids.join(",");
  const [state, setState] = useState<{ key: string; products: ProductCardData[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/products?ids=${key}`).then((r) => r.json()).then((d) => { if (live) setState({ key, products: d.products }); }).catch(() => {});
    return () => { live = false; };
  }, [key]);
  if (!ids.length) return null;
  const products = state?.key === key ? state.products : [];
  if (!products.length) return null;
  const grid = <ProductGrid products={products} priorityCount={0} />;
  return title ? <section className="mt-16"><h2 className="mb-6 text-3xl">{title}</h2>{grid}</section> : grid;
}
