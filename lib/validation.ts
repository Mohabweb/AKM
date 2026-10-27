import { z } from "zod";

export const EG_PHONE = /^01[0125]\d{8}$/;

/** Accepts +20 / 0020 / spaces, returns normalized 01XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let s = raw.replace(/[\s\-()]/g, "");
  if (s.startsWith("+20")) s = "0" + s.slice(3);
  else if (s.startsWith("0020")) s = "0" + s.slice(4);
  return s;
}

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => EG_PHONE.test(v), "Enter a valid Egyptian mobile number (01XXXXXXXXX)");

export const orderNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^AKM-[0-9A-HJKMNP-TV-Z]{6}$/, "Invalid order number");

export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 30;

export const cartLineSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid(),
  items: z.array(cartLineSchema).min(1).max(MAX_LINES),
  couponCode: z.string().trim().toUpperCase().max(40).optional().or(z.literal("").transform(() => undefined)),
  customerName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  governorateId: z.string().uuid(),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(1).max(80),
  address: z.string().trim().min(5).max(300),
  landmark: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(300).optional().or(z.literal("").transform(() => undefined)),
  paymentMethod: z.enum(["cod", "card", "instapay"]),
  turnstileToken: z.string().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackSchema = z.object({
  orderNumber: orderNumberSchema,
  phone: phoneSchema,
  turnstileToken: z.string().optional(),
});

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
