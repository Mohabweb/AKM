"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { ButtonLink } from "@/components/ui/Button";
import { removeFromCart, setQty, useCart } from "@/lib/client/cart";
import { useQuote } from "@/lib/client/quote";
import { formatEGP } from "@/lib/money";

/** Non-animated mini cart. Prices come from /api/quote (the database), never from the browser. */
export function MiniCart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cart = useCart();
  const [seen, setSeen] = useState(false);
  useEffect(() => { if (open) setSeen(true); }, [open]);
  const { quote, loading, error } = useQuote(seen ? cart : []);
  const lines = quote?.lines ?? [];
  return (
    <Drawer open={open} onClose={onClose} title="Your cart" animated={false}>
      {cart.length === 0 ? (
        <div className="p-8 text-center"><p className="font-semibold">Your cart is empty</p><ButtonLink href="/shop" onClick={onClose} className="mt-5">Start shopping</ButtonLink></div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-ink/10 px-5">
            {lines.map((l) => (
              <li key={l.variant_id} className="flex gap-3 py-4">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-sand-2">{l.image_url && <Image src={l.image_url} alt="" fill sizes="80px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1 text-sm">
                  {l.name ? <Link href={`/product/${l.slug}`} onClick={onClose} className="line-clamp-2 font-semibold">{l.name}</Link> : <p className="font-semibold">Item unavailable</p>}
                  {l.size && <p className="text-muted">Size {l.size}{l.color ? ` · ${l.color}` : ""}</p>}
                  {l.issue && <p role="alert" className="font-medium text-danger">{l.issue === "unavailable" ? "No longer available" : l.issue === "out_of_stock" ? "Sold out" : `Only ${l.max_qty} left`}</p>}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full border border-ink/25">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.variant_id, l.qty - 1)} className="size-9">−</button>
                      <span className="tabular w-6 text-center" aria-live="polite">{l.qty}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => setQty(l.variant_id, l.qty + 1)} className="size-9">+</button>
                    </span>
                    {l.unit != null && <span className="tabular font-semibold">{formatEGP(l.unit * l.qty)}</span>}
                  </div>
                  <button type="button" onClick={() => removeFromCart(l.variant_id)} className="mt-1 text-xs text-muted underline">Remove</button>
                </div>
              </li>
            ))}
            {loading && !lines.length && <li className="py-6 text-sm text-muted">Loading…</li>}
            {error && <li className="py-6 text-sm text-danger">Couldn’t load prices. Try again.</li>}
          </ul>
          <div className="border-t border-ink/15 p-5">
            <p className="flex justify-between font-semibold"><span>Subtotal</span><span className="tabular">{quote ? formatEGP(quote.subtotal - (quote.offer_discount ?? 0)) : "—"}</span></p>
            <p className="mt-1 text-xs text-muted">Delivery and any coupon are calculated at checkout.</p>
            <div className="mt-4 grid gap-2">
              <ButtonLink href="/checkout" full onClick={onClose}>Checkout</ButtonLink>
              <ButtonLink href="/cart" variant="outline" full onClick={onClose}>View cart</ButtonLink>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
