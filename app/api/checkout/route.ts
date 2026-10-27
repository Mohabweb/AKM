import { json, readJson, dbError } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { serviceClient } from "@/lib/supabase/service";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkoutSchema } from "@/lib/validation";
import { createPaymobCheckout, paymobConfigured } from "@/lib/payments/paymob";
import { publicEnv } from "@/lib/env";

export async function POST(req: Request) {
  const ip = await clientIp();
  const raw = await readJson(req);
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return json({ error: first?.message ?? "Invalid order", field: first?.path.join(".") }, 400);
  }
  const d = parsed.data;

  // limits: per IP and per phone number (stops both floods and one customer being spammed with orders)
  if (!(await allow("checkout-ip", ip, 600, 10)) || !(await allow("checkout-phone", d.phone, 3600, 6))) {
    return json({ error: "Too many orders from this connection. Please try again later." }, 429);
  }
  if (!(await verifyTurnstile(d.turnstileToken, ip))) return json({ error: "Verification failed. Please refresh and try again." }, 400);

  const sb = serviceClient();
  const { data, error } = await sb.rpc("create_order", {
    p: {
      idempotency_key: d.idempotencyKey,
      payment_method: d.paymentMethod,
      card_provider: d.paymentMethod === "card" ? "paymob" : undefined,
      customer_name: d.customerName,
      phone: d.phone,
      governorate_id: d.governorateId,
      city: d.city, area: d.area, address: d.address, landmark: d.landmark, notes: d.notes,
      coupon_code: d.couponCode,
      items: d.items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    },
  });
  if (error) {
    const e = dbError(error.message);
    return json({ error: e.error, code: e.code }, e.status);
  }
  const order = data as { order_id: string; order_number: string; status: string; total_piasters: number; replayed: boolean };
  let redirectUrl = `/order/${order.order_number}`;

  if (d.paymentMethod === "card" && order.status === "pending_payment") {
    if (!paymobConfigured()) {
      // order exists and stock is held; it will expire. Never pretend a card payment happened.
      return json({ orderNumber: order.order_number, redirectUrl, cardUnavailable: true });
    }
    try {
      const { data: items } = await sb.from("order_items").select("product_name,unit_price_piasters,qty").eq("order_id", order.order_id);
      const pay = await createPaymobCheckout({
        orderNumber: order.order_number,
        totalPiasters: order.total_piasters,
        customerName: d.customerName,
        phone: d.phone,
        items: (items ?? []).map((i) => ({ name: i.product_name, amountPiasters: i.unit_price_piasters, qty: i.qty })),
        returnUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/order/${order.order_number}`,
        webhookUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/webhooks/paymob`,
      });
      redirectUrl = pay.redirectUrl;
    } catch (e) {
      console.error("paymob checkout failed", (e as Error).message);
      return json({ orderNumber: order.order_number, redirectUrl, cardUnavailable: true });
    }
  }
  return json({ orderNumber: order.order_number, redirectUrl, replayed: order.replayed });
}
