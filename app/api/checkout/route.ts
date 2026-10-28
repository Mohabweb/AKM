import { randomUUID } from "node:crypto";
import { dbFailJson, dbError, failJson, json, readJson, validationFail } from "@/lib/api";
import { describeUnexpectedError } from "@/lib/api-errors";
import { allow, clientIp } from "@/lib/rate-limit";
import { serviceClient } from "@/lib/supabase/service";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkoutSchema } from "@/lib/validation";
import { createPaymobCheckout, paymobConfigured } from "@/lib/payments/paymob";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/** Server-side reference the customer can quote to support; also makes log lines findable. */
const newRequestId = () => randomUUID().slice(0, 8);

export async function POST(req: Request) {
  const rid = newRequestId();
  const headers = { "x-request-id": rid };
  try {
    if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
      return failJson(
        "checkout",
        { status: 500, kind: "server", code: "ERROR", error: "We couldn't complete your order just now. Please try again in a moment." },
        { requestId: rid, reason: "SERVICE_KEY_MISSING" },
      );
    }

    const ip = await clientIp();
    const raw = await readJson(req);
    if (raw === null) {
      return failJson(
        "checkout", { status: 400, kind: "validation", code: "VALIDATION", error: "We couldn't read the order details. Please refresh the page and try again." }, { requestId: rid, reason: "BAD_JSON" }, headers);
    }
    const parsed = checkoutSchema.safeParse(raw);
    if (!parsed.success) return validationFail("checkout", parsed.error, "Please check the highlighted fields.", headers);
    const d = parsed.data;

    if (!(await allow("checkout-ip", ip, 600, 10))) {
      return failJson(
        "checkout", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many orders from this connection. Please wait a few minutes and try again." }, { requestId: rid, reason: "RATE_LIMIT_IP" }, headers);
    }
    if (!(await allow("checkout-phone", d.phone, 3600, 6))) {
      return failJson(
        "checkout", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many orders for this phone number. Please wait a little and try again." }, { requestId: rid, reason: "RATE_LIMIT_PHONE", phone: `${d.phone.slice(0, 4)}****` }, headers);
    }
    if (!(await verifyTurnstile(d.turnstileToken, ip))) {
      return failJson(
        "checkout", { status: 400, kind: "validation", code: "TURNSTILE", error: "The verification check failed. Please refresh the page and try again." }, { requestId: rid, reason: "TURNSTILE_FAILED" }, headers);
    }

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
      const fail = dbError(error);
      // Operator hint: a 42883/PGRST202 here almost always means a migration was not applied to this project.
      const hint = fail.reason === "MISSING_DB_FUNCTION" ? "apply the SQL in db/migrations before accepting orders" : undefined;
      return dbFailJson("checkout", error, { requestId: rid, paymentMethod: d.paymentMethod, lines: d.items.length, hint }, headers);
    }

    const order = data as { order_id: string; order_number: string; status: string; total_piasters: number; replayed: boolean };
    let redirectUrl = `/order/${order.order_number}`;

    if (d.paymentMethod === "card" && order.status === "pending_payment") {
      if (!paymobConfigured()) {
        return json({ orderNumber: order.order_number, redirectUrl, cardUnavailable: true }, 200, headers);
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
        console.error(`[checkout] request=${rid} reason=PAYMOB_INIT_FAILED :: ${(e as Error).message}`);
        return json({ orderNumber: order.order_number, redirectUrl, cardUnavailable: true }, 200, headers);
      }
    }
    return json({ orderNumber: order.order_number, redirectUrl, replayed: order.replayed }, 200, headers);
  } catch (e) {
    const fail = describeUnexpectedError(e);
    console.error(`[checkout] request=${rid} UNCAUGHT reason=${fail.reason} :: ${(e as Error)?.stack ?? String(e)}`);
    return failJson(
      "checkout", fail, { requestId: rid }, headers);
  }
}
