import { json } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";
import { verifyPaymobHmac } from "@/lib/payments/paymob";

/**
 * Paymob "transaction processed" callback. The HMAC (query param) proves it came from Paymob; the amount and
 * merchant reference are then checked against OUR order before anything is marked paid.
 */
export async function POST(req: Request) {
  const hmac = new URL(req.url).searchParams.get("hmac");
  let body: { obj?: Record<string, any> };
  try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const obj = body.obj;
  if (!obj || !verifyPaymobHmac(obj, hmac)) return json({ error: "invalid signature" }, 401);

  const ref: string | undefined = obj.order?.merchant_order_id; // = special_reference = our order number
  if (!ref) return json({ ok: true, ignored: "no reference" });
  const sb = serviceClient();
  const { data: order } = await sb.from("orders").select("id,status,total_piasters,payment_method").eq("order_number", ref).maybeSingle();
  if (!order || order.payment_method !== "card") return json({ ok: true, ignored: "unknown order" });

  const txId = String(obj.id);
  const ok = obj.success === true && obj.pending !== true && obj.is_refunded !== true && obj.is_voided !== true;
  if (ok && Number(obj.amount_cents) !== order.total_piasters) {
    console.error("paymob amount mismatch", ref); // never mark an under-paid order as paid
    return json({ ok: true, ignored: "amount mismatch" });
  }
  // unique (provider, provider_ref) makes duplicate deliveries harmless
  const { error: insErr } = await sb.from("payments").upsert(
    { order_id: order.id, provider: "paymob", provider_ref: txId, amount_piasters: Number(obj.amount_cents) || 0,
      status: ok ? "succeeded" : "failed", raw: { success: obj.success, pending: obj.pending, id: obj.id, order: obj.order?.id } },
    { onConflict: "provider,provider_ref" },
  );
  if (insErr) return json({ error: "retry" }, 500);
  if (ok && order.status === "pending_payment") {
    const { error } = await sb.rpc("system_set_order_status", { p_order: order.id, p_to: "paid", p_note: "Card payment confirmed (Paymob)", p_actor_type: "webhook" });
    if (error && !error.message.includes("AKM_BAD_TRANSITION")) return json({ error: "retry" }, 500);
  }
  return json({ ok: true });
}
