import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Paymob (Egypt) hosted Unified Checkout.
 * Request/response fields and the callback HMAC follow Paymob's developer docs:
 *   - Create Intention: POST /v1/intention/  with `Authorization: Token <secret_key>`; amount is in cents (piasters);
 *     `special_reference` comes back as `merchant_order_id`; billing_data.phone_number is required.
 *   - Transaction callback HMAC: SHA-512 over the listed fields, concatenated in the fixed order below.
 * NOT exercised against live Paymob in this repository (no credentials): test with your sandbox keys before launch.
 */

export function paymobConfigured(): boolean {
  return (
    serverEnv.PAYMENT_PROVIDER === "paymob" &&
    !!serverEnv.PAYMOB_SECRET_KEY &&
    !!serverEnv.PAYMOB_PUBLIC_KEY &&
    !!serverEnv.PAYMOB_INTEGRATION_ID &&
    !!serverEnv.PAYMOB_HMAC_SECRET
  );
}

export type PaymobOrder = {
  orderNumber: string;
  totalPiasters: number;
  customerName: string;
  phone: string;
  items: { name: string; amountPiasters: number; qty: number }[];
  returnUrl: string;
  webhookUrl: string;
};

export async function createPaymobCheckout(o: PaymobOrder): Promise<{ redirectUrl: string; intentionId: string }> {
  if (!paymobConfigured()) throw new Error("Paymob is not configured");
  const [first, ...rest] = o.customerName.trim().split(/\s+/);
  const res = await fetch(`${serverEnv.PAYMOB_BASE_URL}/v1/intention/`, {
    method: "POST",
    headers: { Authorization: `Token ${serverEnv.PAYMOB_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: o.totalPiasters,
      currency: "EGP",
      payment_methods: [Number(serverEnv.PAYMOB_INTEGRATION_ID)],
      // item amounts must add up to `amount`; shipping/discounts are folded into one adjustment line when needed
      items: normalizeItems(o),
      billing_data: {
        first_name: first || "Customer",
        last_name: rest.join(" ") || "-",
        phone_number: o.phone,
        email: "no-reply@akm.invalid",
        country: "EG",
      },
      special_reference: o.orderNumber,
      notification_url: o.webhookUrl,
      redirection_url: o.returnUrl,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Paymob intention failed (${res.status})`);
  const json = (await res.json()) as { client_secret?: string; id?: string };
  if (!json.client_secret) throw new Error("Paymob response had no client_secret");
  const url = new URL(`${serverEnv.PAYMOB_BASE_URL}/unifiedcheckout/`);
  url.searchParams.set("publicKey", serverEnv.PAYMOB_PUBLIC_KEY!);
  url.searchParams.set("clientSecret", json.client_secret);
  return { redirectUrl: url.toString(), intentionId: json.id ?? "" };
}

function normalizeItems(o: PaymobOrder) {
  const items = o.items.map((i) => ({ name: i.name.slice(0, 100), amount: i.amountPiasters, quantity: i.qty }));
  const sum = items.reduce((s, i) => s + i.amount * i.quantity, 0);
  const diff = o.totalPiasters - sum; // shipping minus discounts
  if (diff !== 0) items.push({ name: diff > 0 ? "Shipping" : "Discount", amount: diff, quantity: 1 });
  return items;
}

/** Fixed field order from Paymob's "HMAC Transaction Callback" docs (Processed/POST variant). */
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured", "has_parent_transaction", "id", "integration_id",
  "is_3d_secure", "is_auth", "is_capture", "is_refunded", "is_standalone_payment", "is_voided", "order.id",
  "owner", "pending", "source_data.pan", "source_data.sub_type", "source_data.type", "success",
] as const;

const dig = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

export function paymobHmac(obj: unknown, secret: string): string {
  const str = HMAC_FIELDS.map((f) => {
    const v = dig(obj, f);
    return v === undefined || v === null ? "" : String(v);
  }).join("");
  return createHmac("sha512", secret).update(str).digest("hex");
}

export function verifyPaymobHmac(obj: unknown, received: string | null, secret = serverEnv.PAYMOB_HMAC_SECRET): boolean {
  if (!secret || !received) return false;
  const a = Buffer.from(paymobHmac(obj, secret), "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
