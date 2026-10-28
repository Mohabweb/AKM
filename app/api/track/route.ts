import { dbError, failJson, json, readJson, validationFail } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { serviceClient } from "@/lib/supabase/service";
import { verifyTurnstile } from "@/lib/turnstile";
import { trackSchema } from "@/lib/validation";

/** Needs BOTH order number and phone. Same generic answer for "no such order" and "wrong phone". */
export async function POST(req: Request) {
  const ip = await clientIp();
  const parsed = trackSchema.safeParse(await readJson(req, 2_000));
  if (!parsed.success) return validationFail("track", parsed.error, "Enter your order number and the phone number used for the order.");
  const { orderNumber, phone, turnstileToken } = parsed.data;
  // tight limits make guessing order numbers impractical: 8/10min per IP, 5/hour per order number
  if (!(await allow("track-ip", ip, 600, 8)) || !(await allow("track-order", orderNumber, 3600, 5))) {
    return failJson("track", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many attempts. Please try again later." });
  }
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return failJson("track", { status: 400, kind: "validation", code: "TURNSTILE", error: "Verification failed. Please refresh and try again." });
  }
  const { data, error } = await serviceClient().rpc("track_order", { p_number: orderNumber, p_phone: phone });
  if (error) {
    const e = dbError(error.message);
    e.error = "We couldn't look up that order. Please try again.";
    return failJson("track", e, { supabase: error.message, code: error.code });
  }
  if (!data) return json({ error: "We couldn't find an order matching those details." }, 404);
  return json(data);
}
