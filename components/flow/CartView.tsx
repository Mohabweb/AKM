"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Price } from "@/components/ui/Price";
import { clearCart, removeFromCart, setCoupon, setQty, useCart, useCoupon } from "@/lib/client/cart";
import { useQuote } from "@/lib/client/quote";
import { Summary, couponMessage } from "./Summary";

export function CartView() {
  const cart = useCart();
  const coupon = useCoupon();
  const [draft, setDraft] = useState("");
  const { quote, loading, error } = useQuote(cart, { couponCode: coupon });
  if (!cart.length) return <EmptyState title="Your cart is empty" action={<ButtonLink href="/shop">Browse shoes</ButtonLink>}>Add something you love and it will wait for you here.</EmptyState>;
  const lines = quote?.lines ?? [];
  const blocked = !quote || lines.some((l) => l.issue) || loading;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <section aria-label="Cart items">
        <ul className="divide-y divide-ink/15 border-y border-ink/15">
          {cart.map((c) => {
            const l = lines.find((x) => x.variant_id === c.variantId);
            return (
              <li key={c.variantId} className="flex gap-4 py-5">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-sand-2 sm:size-28">{l?.image_url && <Image src={l.image_url} alt="" fill sizes="112px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  {l?.name ? <Link href={`/product/${l.slug}`} className="font-semibold underline-offset-4 hover:underline">{l.name}</Link> : <p className="font-semibold">{loading ? "Loading…" : "Item no longer available"}</p>}
                  {l?.brand && <p className="text-xs uppercase tracking-widest text-muted">{l.brand}</p>}
                  {l?.size && <p className="text-sm text-muted">Size {l.size}{l.color ? ` · ${l.color}` : ""}</p>}
                  {l?.issue && (
                    <p role="alert" className="mt-1 text-sm font-semibold text-danger">
                      {l.issue === "unavailable" ? "This item is no longer available. Please remove it." : l.issue === "out_of_stock" ? "Sold out. Please remove it." : `Only ${l.max_qty} left. Please lower the quantity.`}
                    </p>
                  )}
                  {l?.stock_left && !l.issue ? <p className="text-sm font-semibold text-warn">Only {l.stock_left} left</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-ink/30 bg-white">
                      <button type="button" aria-label={`Decrease quantity of ${l?.name ?? "item"}`} onClick={() => setQty(c.variantId, c.qty - 1)} className="size-11 text-lg">−</button>
                      <span className="tabular w-8 text-center font-semibold" aria-label="Quantity">{c.qty}</span>
                      <button type="button" aria-label={`Increase quantity of ${l?.name ?? "item"}`} onClick={() => setQty(c.variantId, c.qty + 1)} className="size-11 text-lg">+</button>
                    </span>
                    {l?.unit != null && <Price price={l.unit * c.qty} original={l.orig && l.orig > l.unit ? l.orig * c.qty : null} />}
                  </div>
                  <button type="button" onClick={() => removeFromCart(c.variantId)} className="mt-2 min-h-11 text-sm text-muted underline">Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={clearCart} className="mt-3 min-h-11 text-sm text-muted underline">Empty cart</button>
      </section>

      <aside aria-label="Order summary" className="h-fit rounded-[var(--radius-card)] bg-white p-5">
        <h2 className="mb-4 text-2xl">Order summary</h2>
        <form className="mb-5" onSubmit={(e) => { e.preventDefault(); setCoupon(draft.trim().toUpperCase()); }}>
          <label htmlFor="coupon" className="mb-1.5 block text-sm font-semibold">Coupon code</label>
          <div className="flex gap-2">
            <input id="coupon" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" maxLength={40}
              className="min-h-11 w-full rounded-xl border border-ink/25 px-3 uppercase" />
            <Button type="submit" variant="dark" disabled={!draft.trim()}>Apply</Button>
          </div>
          {quote?.coupon_error && coupon && <p role="alert" className="mt-1.5 text-sm font-medium text-danger">{couponMessage(quote.coupon_error)}</p>}
          {quote?.coupon && <p className="mt-1.5 text-sm font-medium text-ok">Coupon {quote.coupon.code} applied. <button type="button" onClick={() => { setCoupon(""); setDraft(""); }} className="underline">Remove</button></p>}
        </form>
        {quote ? <Summary q={quote} showShipping={false} /> : error ? <p role="alert" className="text-sm text-danger">We couldn’t load your prices. Please refresh.</p> : <p className="text-sm text-muted">Loading prices…</p>}
        <div className="mt-5">
          {blocked ? <Button full size="lg" disabled>Checkout</Button> : <ButtonLink href="/checkout" full size="lg">Checkout</ButtonLink>}
          {lines.some((l) => l.issue) && <p className="mt-2 text-sm text-danger">Fix the items marked above to continue.</p>}
        </div>
      </aside>
    </div>
  );
}
