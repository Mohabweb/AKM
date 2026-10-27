"use client";
import { createLocalStore } from "./store";

export type CartLine = { variantId: string; qty: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QTY = 10;

const store = createLocalStore<CartLine[]>("akm.cart.v1", [], (v) => {
  if (!Array.isArray(v)) return null;
  const out: CartLine[] = [];
  for (const l of v.slice(0, 30)) {
    if (l && typeof l === "object" && typeof (l as CartLine).variantId === "string" && UUID.test((l as CartLine).variantId)
        && Number.isInteger((l as CartLine).qty)) {
      out.push({ variantId: (l as CartLine).variantId, qty: Math.min(Math.max((l as CartLine).qty, 1), MAX_QTY) });
    }
  }
  return out;
});

export const useCart = store.useStore;
export const getCart = store.get;

export function addToCart(variantId: string, qty = 1) {
  const cart = store.get();
  const found = cart.find((l) => l.variantId === variantId);
  store.set(found
    ? cart.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(l.qty + qty, MAX_QTY) } : l))
    : [...cart, { variantId, qty: Math.min(qty, MAX_QTY) }].slice(0, 30));
}
export function setQty(variantId: string, qty: number) {
  store.set(qty <= 0 ? store.get().filter((l) => l.variantId !== variantId)
    : store.get().map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(qty, MAX_QTY) } : l)));
}
export const removeFromCart = (variantId: string) => setQty(variantId, 0);
export const clearCart = () => store.set([]);
export const cartCount = (c: CartLine[]) => c.reduce((n, l) => n + l.qty, 0);

const coupon = createLocalStore<string>("akm.coupon.v1", "", (v) => (typeof v === "string" ? v.toUpperCase().slice(0, 40) : null));
export const useCoupon = coupon.useStore;
export const setCoupon = coupon.set;
