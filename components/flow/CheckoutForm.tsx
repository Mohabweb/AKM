"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { clearCart, setCoupon, useCart, useCoupon } from "@/lib/client/cart";
import { useQuote } from "@/lib/client/quote";
import { formatEGP } from "@/lib/money";
import { normalizePhone, EG_PHONE } from "@/lib/validation";
import { Summary, couponMessage } from "./Summary";
import { Turnstile, turnstileEnabled } from "./Turnstile";

type Zone = { id: string; governorate: string; fee_piasters: number };
type Opts = { cod: boolean; instapay: boolean; card: boolean; cardConfigured: boolean };
type Errs = Partial<Record<"customerName" | "phone" | "governorateId" | "city" | "area" | "address" | "landmark" | "paymentMethod" | "form", string>>;

const IDEM = "akm.idem.v1";
/** One key per checkout attempt: created once, reused for retries (so a double-click or lost response can never create two orders),
 *  and cleared only after the order is confirmed. */
function attemptKey(): string {
  try { const k = sessionStorage.getItem(IDEM); if (k) return k; const n = crypto.randomUUID(); sessionStorage.setItem(IDEM, n); return n; } catch { return crypto.randomUUID(); }
}

export function CheckoutForm({ zones, options, instapayNumber }: { zones: Zone[]; options: Opts; instapayNumber: string }) {
  const router = useRouter();
  const cart = useCart();
  const coupon = useCoupon();
  const [zone, setZone] = useState("");
  const [method, setMethod] = useState<"cod" | "instapay" | "card" | "">(options.cod ? "cod" : options.instapay ? "instapay" : "");
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const onToken = useCallback((t: string) => setToken(t), []);
  const key = useRef<string>("");
  useEffect(() => { key.current = attemptKey(); }, []);
  const { quote } = useQuote(cart, { couponCode: coupon, governorateId: zone || undefined });

  if (!cart.length) return <EmptyState title="Your cart is empty" action={<ButtonLink href="/shop">Browse shoes</ButtonLink>} />;
  const issues = quote?.lines.some((l) => l.issue);
  const blocked = busy || !quote || !!issues || (method === "card" && !options.cardConfigured);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const phone = normalizePhone(v("phone"));
    const er: Errs = {};
    if (v("customerName").length < 2) er.customerName = "Enter your full name.";
    if (!EG_PHONE.test(phone)) er.phone = "Enter a valid Egyptian mobile number, like 01012345678.";
    if (!zone) er.governorateId = "Choose your governorate.";
    if (v("city").length < 2) er.city = "Enter your city.";
    if (!v("area")) er.area = "Enter your area or district.";
    if (v("address").length < 5) er.address = "Enter your street and building.";
    if (v("landmark").length < 2) er.landmark = "Add a landmark so the courier can find you.";
    if (!method) er.paymentMethod = "Choose how you want to pay.";
    if (turnstileEnabled && !token) er.form = "Please complete the verification below.";
    setErrs(er);
    if (Object.keys(er).length) { document.getElementById(`co-${Object.keys(er)[0]}`)?.focus(); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key.current, items: cart, couponCode: coupon || undefined, customerName: v("customerName"), phone,
          governorateId: zone, city: v("city"), area: v("area"), address: v("address"), landmark: v("landmark"), notes: v("notes") || undefined,
          paymentMethod: method, turnstileToken: token || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrs({ form: data.error ?? "Something went wrong. Please try again.", ...(data.field && typeof data.field === "string" ? { [data.field]: data.error } : {}) });
        setBusy(false);
        window.turnstile?.reset();
        setToken("");
        return;
      }
      try { sessionStorage.setItem("akm.last.v1", JSON.stringify({ n: data.orderNumber, p: phone })); sessionStorage.removeItem(IDEM); } catch { /* ignore */ }
      clearCart(); setCoupon("");
      if (typeof data.redirectUrl === "string" && /^https:\/\//.test(data.redirectUrl)) window.location.assign(data.redirectUrl); // Paymob hosted page
      else router.push(`/order/${data.orderNumber}${data.cardUnavailable ? "?card=unavailable" : ""}`);
    } catch {
      setErrs({ form: "Network problem. Your order was not placed twice: press Place order to try again." });
      setBusy(false);
    }
  }

  const radio = "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-ink/25 bg-white p-4 has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink";
  return (
    <form id="checkout-form" onSubmit={submit} noValidate className="grid gap-10 pb-28 lg:grid-cols-[1.4fr_1fr] lg:pb-0">
      <div className="space-y-10">
        {errs.form && <p id="co-form" tabIndex={-1} role="alert" className="rounded-xl bg-danger-50 p-4 font-semibold text-danger">{errs.form}</p>}
        <section aria-labelledby="h-contact" className="space-y-4">
          <h2 id="h-contact" className="text-2xl">Contact</h2>
          <Input id="co-customerName" name="customerName" label="Full name" autoComplete="name" error={errs.customerName} required />
          <Input id="co-phone" name="phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" hint="We call or message this number about your delivery." error={errs.phone} required />
        </section>
        <section aria-labelledby="h-addr" className="space-y-4">
          <h2 id="h-addr" className="text-2xl">Delivery address</h2>
          <Select id="co-governorateId" label="Governorate" value={zone} onChange={(e) => setZone(e.target.value)} error={errs.governorateId} required>
            <option value="">Choose…</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.governorate}</option>)}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="co-city" name="city" label="City" autoComplete="address-level2" error={errs.city} required />
            <Input id="co-area" name="area" label="Area / district" autoComplete="address-level3" error={errs.area} required />
          </div>
          <Input id="co-address" name="address" label="Street and building" autoComplete="street-address" error={errs.address} required />
          <Input id="co-landmark" name="landmark" label="Nearest landmark" hint="For example: next to a mosque, opposite a pharmacy." error={errs.landmark} required />
          <Textarea id="notes" name="notes" label="Delivery notes (optional)" maxLength={300} />
        </section>
        <fieldset id="co-paymentMethod" tabIndex={-1} className="space-y-3" aria-describedby={errs.paymentMethod ? "pm-err" : undefined}>
          <legend className="mb-2 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>Payment</legend>
          {options.cod && <label className={radio}><input type="radio" name="pm" checked={method === "cod"} onChange={() => setMethod("cod")} className="mt-1 size-5 accent-[var(--color-teal-600)]" /><span><span className="font-semibold">Cash on delivery</span><br /><span className="text-sm text-muted">Pay the courier when your order arrives.</span></span></label>}
          {options.instapay && <label className={radio}><input type="radio" name="pm" checked={method === "instapay"} onChange={() => setMethod("instapay")} className="mt-1 size-5 accent-[var(--color-teal-600)]" /><span><span className="font-semibold">InstaPay transfer</span><br /><span className="text-sm text-muted">You transfer the total to {instapayNumber ? <strong className="tabular">{instapayNumber}</strong> : "our InstaPay account"} and upload the receipt on the next page. We confirm it and then ship.</span></span></label>}
          {options.card && <label className={radio}><input type="radio" name="pm" checked={method === "card"} onChange={() => setMethod("card")} className="mt-1 size-5 accent-[var(--color-teal-600)]" /><span><span className="font-semibold">Visa / Mastercard</span><br /><span className="text-sm text-muted">{options.cardConfigured ? "You’ll be taken to our payment provider’s secure page. We never see your card details." : "Card payment is not available yet. Please choose another method."}</span></span></label>}
          {!options.cod && !options.instapay && !options.card && <p className="text-danger">No payment method is available right now. Please contact us.</p>}
          {errs.paymentMethod && <p id="pm-err" role="alert" className="text-sm font-medium text-danger">{errs.paymentMethod}</p>}
        </fieldset>
        <Turnstile onToken={onToken} />
      </div>

      <aside aria-label="Order summary" className="h-fit rounded-[var(--radius-card)] bg-white p-5 lg:sticky lg:top-6">
        <h2 className="mb-4 text-2xl">Order summary</h2>
        <ul className="mb-4 divide-y divide-ink/10 text-sm">
          {quote?.lines.map((l) => <li key={l.variant_id} className="flex justify-between gap-3 py-2"><span>{l.name ?? "Item"} {l.size && `· ${l.size}`} × {l.qty}</span><span className="tabular">{l.unit != null && formatEGP(l.unit * l.qty)}</span></li>)}
        </ul>
        {coupon && quote?.coupon_error && <p role="alert" className="mb-3 text-sm font-medium text-danger">{couponMessage(quote.coupon_error)} <button type="button" onClick={() => setCoupon("")} className="underline">Remove code</button></p>}
        {quote ? <Summary q={quote} showShipping /> : <p className="text-sm text-muted">Loading prices…</p>}
        {issues && <p role="alert" className="mt-3 text-sm font-semibold text-danger">Some items changed. <a href="/cart" className="underline">Review your cart</a>.</p>}
        <Button type="submit" size="lg" full className="mt-5 hidden lg:inline-flex" disabled={blocked}>{busy ? "Placing order…" : "Place order"}</Button>
        <p className="mt-3 text-xs text-muted">By placing your order you agree to our <a href="/terms" className="underline">terms</a> and <a href="/returns" className="underline">returns policy</a>.</p>
      </aside>
      {/* Phones: total + pay button stay in view. Static (no animation); desktop uses the sticky summary instead. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/15 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <p className="tabular text-sm"><span className="block text-xs text-muted">Total</span><strong className="text-lg">{quote ? formatEGP(quote.total) : "…"}</strong></p>
          <Button type="submit" form="checkout-form" size="lg" className="flex-1" disabled={blocked}>{busy ? "Placing order…" : "Place order"}</Button>
        </div>
      </div>
    </form>
  );
}
