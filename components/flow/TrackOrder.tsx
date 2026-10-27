"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { formatEGP } from "@/lib/money";
import { normalizePhone, EG_PHONE } from "@/lib/validation";
import { Turnstile, turnstileEnabled } from "./Turnstile";

type Tracked = {
  order_number: string; status: string; payment_method: "cod" | "card" | "instapay"; created_at: string; governorate: string;
  subtotal_piasters: number; discount_piasters: number; shipping_piasters: number; total_piasters: number;
  items: { name: string; brand: string | null; size: string; color: string; qty: number; unit_price_piasters: number }[];
  events: { status: string; at: string }[];
};
const LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment", awaiting_verification: "Payment under review", paid: "Payment received", processing: "Preparing your order",
  shipped: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};
const TONE: Record<string, "warn" | "ok" | "danger" | "teal"> = { pending_payment: "warn", awaiting_verification: "warn", paid: "ok", processing: "teal", shipped: "teal", delivered: "ok", cancelled: "danger", refunded: "danger" };
const fmtDate = (s: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(s));

export function TrackOrder({ initialNumber = "", confirmation = false, instapayNumber, instapayName, cardNotice }: {
  initialNumber?: string; confirmation?: boolean; instapayNumber?: string; instapayName?: string; cardNotice?: boolean;
}) {
  const [number, setNumber] = useState(initialNumber);
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<Tracked | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const onToken = useCallback((t: string) => setToken(t), []);
  const auto = useRef(false);

  const lookup = useCallback(async (n: string, p: string, t?: string) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber: n, phone: p, turnstileToken: t || undefined }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error ?? "Something went wrong."); setData(null); window.turnstile?.reset(); setToken(""); } else setData(d);
    } catch { setErr("Network problem. Please try again."); }
    setBusy(false);
  }, []);

  // Right after checkout the phone is in this tab's sessionStorage, so the confirmation shows without asking again.
  useEffect(() => {
    if (auto.current || !confirmation) return;
    auto.current = true;
    try {
      const last = JSON.parse(sessionStorage.getItem("akm.last.v1") ?? "null");
      if (last?.n === initialNumber && EG_PHONE.test(last.p)) { setPhone(last.p); if (!turnstileEnabled) lookup(initialNumber, last.p); else lookup(initialNumber, last.p, ""); }
    } catch { /* ignore */ }
  }, [confirmation, initialNumber, lookup]);

  if (!data) {
    return (
      <form noValidate className="mx-auto max-w-md space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const p = normalizePhone(phone);
        if (!EG_PHONE.test(p)) { setErr("Enter the mobile number you used for the order."); return; }
        if (turnstileEnabled && !token) { setErr("Please complete the verification."); return; }
        lookup(number.trim().toUpperCase(), p, token);
      }}>
        {confirmation && <p className="text-muted">For your privacy, confirm the phone number used for this order to see its details.</p>}
        <Input id="t-number" label="Order number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="AKM-XXXXXX" autoCapitalize="characters" autoComplete="off" required />
        <Input id="t-phone" label="Mobile number" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
        <Turnstile onToken={onToken} />
        {err && <p role="alert" className="font-medium text-danger">{err}</p>}
        <Button type="submit" full disabled={busy}>{busy ? "Looking…" : confirmation ? "Show my order" : "Track order"}</Button>
      </form>
    );
  }

  const canUpload = data.payment_method === "instapay" && ["pending_payment", "awaiting_verification"].includes(data.status);
  return (
    <div className="space-y-8">
      <div className="rounded-[var(--radius-card)] bg-white p-6">
        {confirmation && <p className="mb-1 font-semibold text-ok">Thank you — we received your order.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-muted">Order number</p><p className="tabular text-2xl font-bold">{data.order_number}</p></div>
          <Badge tone={TONE[data.status] ?? "sand"}>{LABEL[data.status] ?? data.status}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted">Keep this number: you need it, with your phone number, to track the order.</p>
        {data.payment_method === "cod" && !["cancelled", "refunded", "delivered"].includes(data.status) && <p className="mt-3">Please have <strong className="tabular">{formatEGP(data.total_piasters)}</strong> ready for the courier.</p>}
      </div>

      {cardNotice && data.payment_method === "card" && data.status === "pending_payment" && (
        <p role="status" className="rounded-xl bg-warn-50 p-4 font-medium text-warn">Card payment isn’t available right now, so this order has not been paid. Please contact us, or place a new order with another payment method. Unpaid orders are cancelled automatically.</p>
      )}
      {data.payment_method === "card" && data.status === "pending_payment" && !cardNotice && <p role="status" className="rounded-xl bg-warn-50 p-4 font-medium text-warn">We are waiting for your card payment to be confirmed. If you completed it, this page updates within a minute or two.</p>}

      {data.payment_method === "instapay" && data.status === "pending_payment" && (
        <section className="rounded-[var(--radius-card)] border-2 border-ink bg-white p-6">
          <h2 className="text-2xl">Pay with InstaPay</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Transfer exactly <strong className="tabular">{formatEGP(data.total_piasters)}</strong> to {instapayNumber ? <strong className="tabular">{instapayNumber}</strong> : "our InstaPay account"}{instapayName ? ` (${instapayName})` : ""}.</li>
            <li>Take a screenshot of the confirmation.</li>
            <li>Upload it below. We check it and then prepare your order.</li>
          </ol>
        </section>
      )}
      {canUpload && <ReceiptUpload number={data.order_number} phone={normalizePhone(phone)} onDone={() => lookup(data.order_number, normalizePhone(phone), token)} awaiting={data.status === "awaiting_verification"} />}

      <section>
        <h2 className="mb-3 text-2xl">Progress</h2>
        <ol className="space-y-3 border-l-2 border-ink/20 pl-5">
          {data.events.map((e, i) => <li key={i}><p className="font-semibold">{LABEL[e.status] ?? e.status}</p><p className="text-sm text-muted">{fmtDate(e.at)}</p></li>)}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">Items</h2>
        <ul className="divide-y divide-ink/15 rounded-[var(--radius-card)] bg-white px-5">
          {data.items.map((it, i) => <li key={i} className="flex justify-between gap-4 py-3 text-sm"><span>{it.brand ? `${it.brand} · ` : ""}{it.name} — size {it.size}{it.color ? `, ${it.color}` : ""} × {it.qty}</span><span className="tabular font-semibold">{formatEGP(it.unit_price_piasters * it.qty)}</span></li>)}
        </ul>
        <dl className="tabular mt-3 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatEGP(data.subtotal_piasters)}</dd></div>
          {data.discount_piasters > 0 && <div className="flex justify-between text-teal-700"><dt>Discount</dt><dd>−{formatEGP(data.discount_piasters)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery to {data.governorate}</dt><dd>{data.shipping_piasters ? formatEGP(data.shipping_piasters) : "Free"}</dd></div>
          <div className="flex justify-between border-t border-ink/20 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatEGP(data.total_piasters)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function ReceiptUpload({ number, phone, onDone, awaiting }: { number: string; phone: string; onDone: () => void; awaiting: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="rounded-[var(--radius-card)] bg-white p-6" onSubmit={async (e) => {
      e.preventDefault();
      const file = new FormData(e.currentTarget).get("file");
      if (!(file instanceof File) || !file.size) { setMsg({ ok: false, text: "Choose an image first." }); return; }
      if (file.size > 5 * 1024 * 1024) { setMsg({ ok: false, text: "That file is over 5 MB." }); return; }
      setBusy(true); setMsg(null);
      const fd = new FormData(); fd.set("orderNumber", number); fd.set("phone", phone); fd.set("file", file);
      try {
        const r = await fetch("/api/receipt", { method: "POST", body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { setMsg({ ok: true, text: "Receipt received. We’ll confirm your payment soon." }); onDone(); } else setMsg({ ok: false, text: d.error ?? "Upload failed." });
      } catch { setMsg({ ok: false, text: "Network problem. Please try again." }); }
      setBusy(false);
    }}>
      <h2 className="text-2xl">{awaiting ? "Receipt received — upload another?" : "Upload your receipt"}</h2>
      <p className="mt-1 text-sm text-muted">JPG, PNG or WebP, up to 5 MB.</p>
      <label htmlFor="receipt" className="mt-4 block text-sm font-semibold">Receipt screenshot</label>
      <input id="receipt" name="file" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-ink file:px-5 file:text-sand" />
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-3 font-medium ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}
      <Button type="submit" className="mt-4" disabled={busy}>{busy ? "Uploading…" : "Upload receipt"}</Button>
    </form>
  );
}
