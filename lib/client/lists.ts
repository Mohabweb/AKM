"use client";
import { createLocalStore } from "./store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 60) : null);

const wish = createLocalStore<string[]>("akm.wishlist.v1", [], ids);
export const useWishlist = wish.useStore;
export function toggleWish(id: string) {
  const w = wish.get();
  wish.set(w.includes(id) ? w.filter((x) => x !== id) : [id, ...w].slice(0, 60));
}

const recent = createLocalStore<string[]>("akm.recent.v1", [], ids);
export const useRecent = recent.useStore;
export function pushRecent(id: string) {
  recent.set([id, ...recent.get().filter((x) => x !== id)].slice(0, 12));
}
