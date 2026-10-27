import { z } from "zod";
import { json, readJson } from "@/lib/api";
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
  if (!(await allow("quote", await clientIp(), 60, 60))) return json({ error: "Too many requests" }, 429);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const { items, couponCode, governorateId } = parsed.data;
  const { data, error } = await serviceClient().rpc("quote_cart", {
    p: { items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })), coupon_code: couponCode, governorate_id: governorateId },
  });
  if (error) return json({ error: "Could not price your cart" }, 500);
  return json(data);
}
