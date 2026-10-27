import { formatEGP } from "@/lib/money";
import type { Quote } from "@/lib/client/quote";

/** Totals come straight from the database quote; this component only formats them. */
export function Summary({ q, showShipping }: { q: Quote; showShipping: boolean }) {
  const offer = q.offer_discount ?? 0;
  const coupon = q.coupon_discount ?? Math.max(q.discount - offer, 0);
  const row = "flex justify-between py-1";
  return (
    <dl className="tabular text-sm">
      <div className={row}><dt>Subtotal</dt><dd>{formatEGP(q.subtotal)}</dd></div>
      {q.applied_offers?.map((o) => <div key={o.name} className={`${row} text-teal-700`}><dt>{o.name}</dt><dd>−{formatEGP(o.amount)}</dd></div>)}
      {coupon > 0 && <div className={`${row} text-teal-700`}><dt>Coupon{q.coupon ? ` ${q.coupon.code}` : ""}</dt><dd>−{formatEGP(coupon)}</dd></div>}
      <div className={row}><dt>Delivery</dt><dd>{showShipping ? (q.shipping == null ? "Choose governorate" : q.shipping === 0 ? "Free" : formatEGP(q.shipping)) : "Calculated at checkout"}</dd></div>
      {q.free_shipping_remaining != null && q.free_shipping_remaining > 0 && <p className="py-1 text-xs text-muted">Add {formatEGP(q.free_shipping_remaining)} more for free delivery.</p>}
      <div className="mt-2 flex justify-between border-t border-ink/20 pt-3 text-base font-bold"><dt>Total</dt><dd>{formatEGP(q.total)}</dd></div>
    </dl>
  );
}

export const couponMessage = (e: string | null) =>
  !e ? "" : e === "unavailable" ? "That code isn't valid." : e === "used_up" ? "That code has been fully used." :
  e.startsWith("min_subtotal:") ? `Spend ${formatEGP(Number(e.split(":")[1]))} or more to use this code.` :
  e === "not_eligible" ? "That code doesn't apply to the items in your cart." : e === "already_used" ? "You have already used this code." : "That code can't be applied.";
