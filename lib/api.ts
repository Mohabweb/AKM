import "server-only";
import { NextResponse } from "next/server";

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Maps database error codes (raised by the SQL functions) to safe, human messages. Never leaks internals. */
export function dbError(message: string): { status: number; error: string; code: string } {
  const m = message.match(/AKM_[A-Z_]+/)?.[0] ?? "";
  switch (m) {
    case "AKM_OUT_OF_STOCK": return { status: 409, code: m, error: "Some items are no longer available in the quantity you chose. Please review your cart." };
    case "AKM_UNAVAILABLE": return { status: 409, code: m, error: "An item in your cart is no longer available." };
    case "AKM_COUPON_INVALID": return { status: 422, code: m, error: "That coupon can't be applied to this order." };
    case "AKM_BAD_GOVERNORATE": return { status: 422, code: m, error: "Please choose a valid governorate." };
    case "AKM_PAYMENT_DISABLED": return { status: 422, code: m, error: "That payment method isn't available right now." };
    case "AKM_BAD_QTY": return { status: 422, code: m, error: "Invalid quantity." };
    case "AKM_EMPTY_CART": return { status: 422, code: m, error: "Your cart is empty." };
    case "AKM_RETRY": return { status: 503, code: m, error: "Please try again." };
    default: return { status: 500, code: "ERROR", error: "Something went wrong. Please try again." };
  }
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<unknown | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
