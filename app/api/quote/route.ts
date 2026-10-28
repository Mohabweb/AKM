import { z } from "zod";
import { dbError, failJson, json, readJson, validationFail } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { serviceClient } from "@/lib/supabase/service";
import { cartLineSchema, MAX_LINES } from "@/lib/validation";

const schema = z.object({
  items: z.array(cartLineSchema).max(MAX_LINES),
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  governorateId: z.string().uuid().optional(),
});

/** Prices the cart from the database for display. Never creates or changes anything. */
export async function POST(req: Request) {
  if (!(await allow("quote", await clientIp(), 60, 60))) {
    return failJson("quote", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many requests. Please try again in a moment." });
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return validationFail("quote", parsed.error, "Invalid request");
  const { items, couponCode, governorateId } = parsed.data;
  const { data, error } = await serviceClient().rpc("quote_cart", {
    p: { items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })), coupon_code: couponCode, governorate_id: governorateId },
  });
  if (error) {
    const e = dbError(error.message);
    e.error = "Could not price your cart. Please try again.";
    return failJson("quote", e, { supabase: error.message, code: error.code });
  }
  return json(data);
}
