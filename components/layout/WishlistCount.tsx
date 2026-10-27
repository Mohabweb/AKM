"use client";
import { useWishlist } from "@/lib/client/lists";
export function WishlistCount() {
  const n = useWishlist().length;
  return n ? <span className="tabular absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold leading-5 text-sand"><span className="sr-only">{n} saved</span><span aria-hidden>{n}</span></span> : null;
}
