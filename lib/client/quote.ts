"use client";
import { useEffect, useState } from "react";
import type { CartLine } from "./cart";

export type QuoteLine = {
  variant_id: string; product_id?: string; slug?: string; name?: string; brand?: string | null; sku?: string; size?: string; color?: string;
  image_url?: string | null; unit?: number; orig?: number; qty: number; issue?: "unavailable" | "out_of_stock" | "limited_stock" | null;
  max_qty?: number | null; stock_left?: number | null;
};
export type Quote = {
  lines: QuoteLine[]; subtotal: number; discount: number; offer_discount?: number; coupon_discount?: number;
  applied_offers?: { name: string; amount: number }[];
  shipping: number | null; total: number; coupon: { code: string; type: string } | null; coupon_error: string | null;
  free_shipping_threshold: number; free_shipping_remaining: number | null; zone: { id: string; name: string } | null;
};

/** Fetches a database price quote for the cart. Re-fetches when lines / coupon / governorate change. */
export function useQuote(cart: CartLine[], opts: { couponCode?: string; governorateId?: string } = {}) {
  const [state, setState] = useState<{ quote: Quote | null; loading: boolean; error: boolean }>({ quote: null, loading: false, error: false });
  const key = JSON.stringify([cart, opts.couponCode ?? "", opts.governorateId ?? ""]);
  useEffect(() => {
    if (!cart.length) { setState({ quote: null, loading: false, error: false }); return; }
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: false }));
    fetch("/api/quote", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ items: cart, couponCode: opts.couponCode || undefined, governorateId: opts.governorateId || undefined }),
    })
      .then(async (r) => { if (!r.ok) throw new Error(); setState({ quote: await r.json(), loading: false, error: false }); })
      .catch((e) => { if (e.name !== "AbortError") setState((s) => ({ ...s, loading: false, error: true })); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
