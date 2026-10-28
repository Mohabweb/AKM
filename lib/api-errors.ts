/**
 * Pure mapping from database / transport failures to (a) a safe message the customer may see and
 * (b) a precise server-side reason for the operator. No "server-only" import here so it is unit-testable
 * and reusable from route handlers and server actions alike.
 */
export type FailKind = "validation" | "out_of_stock" | "rate_limit" | "server";

export type ApiFail = { status: number; error: string; code: string; kind: FailKind };

/** What the operator sees in the server log: a stable slug, never shown to the customer. */
export type DbFailure = ApiFail & { reason: string; sqlState?: string };

type PgErrorLike = { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };

const SERVER_TRY_AGAIN: ApiFail = {
  status: 500,
  kind: "server",
  code: "ERROR",
  error: "We couldn't complete your order just now. Please try again in a moment.",
};

/** Stable AKM_* exceptions raised by the SQL functions. */
const AKM: Record<string, ApiFail & { reason: string }> = {
  AKM_OUT_OF_STOCK: { status: 409, kind: "out_of_stock", code: "AKM_OUT_OF_STOCK", error: "Some items are no longer available in the quantity you chose. Please update your cart and try again.", reason: "OUT_OF_STOCK" },
  AKM_UNAVAILABLE: { status: 409, kind: "out_of_stock", code: "AKM_UNAVAILABLE", error: "An item in your cart is no longer available. Please remove it to continue.", reason: "ITEM_UNAVAILABLE" },
  AKM_COUPON_INVALID: { status: 422, kind: "validation", code: "AKM_COUPON_INVALID", error: "That coupon can't be used for this order. Please remove it and try again.", reason: "COUPON_INVALID" },
  AKM_BAD_GOVERNORATE: { status: 422, kind: "validation", code: "AKM_BAD_GOVERNORATE", error: "Please choose a valid governorate for delivery.", reason: "BAD_GOVERNORATE" },
  AKM_PAYMENT_DISABLED: { status: 422, kind: "validation", code: "AKM_PAYMENT_DISABLED", error: "That payment method isn't available right now. Please choose another one.", reason: "PAYMENT_DISABLED" },
  AKM_BAD_QTY: { status: 422, kind: "validation", code: "AKM_BAD_QTY", error: "Please choose a quantity between 1 and 10 for each item.", reason: "BAD_QTY" },
  AKM_EMPTY_CART: { status: 422, kind: "validation", code: "AKM_EMPTY_CART", error: "Your cart is empty.", reason: "EMPTY_CART" },
  AKM_RETRY: { status: 503, kind: "server", code: "AKM_RETRY", error: "Please press Place order once more.", reason: "RETRY" },
  AKM_RECEIPT_NOT_ALLOWED: { status: 409, kind: "validation", code: "AKM_RECEIPT_NOT_ALLOWED", error: "This order can't accept a receipt right now.", reason: "RECEIPT_NOT_ALLOWED" },
  AKM_ORDER_NOT_FOUND: { status: 404, kind: "validation", code: "AKM_ORDER_NOT_FOUND", error: "We couldn't find that order.", reason: "ORDER_NOT_FOUND" },
  AKM_FORBIDDEN: { status: 403, kind: "validation", code: "AKM_FORBIDDEN", error: "You don't have permission to do that.", reason: "FORBIDDEN" },
  AKM_NOT_FOUND: { status: 404, kind: "validation", code: "AKM_NOT_FOUND", error: "That item no longer exists. Please refresh the page.", reason: "NOT_FOUND" },
};

const PHONE_MESSAGE = "Enter a valid Egyptian mobile number (01XXXXXXXXX).";

/**
 * Classifies a Supabase/PostgREST error. The customer message stays generic where the cause is ours
 * (missing migration, missing grant) and specific where the customer can act (stock, coupon, address).
 */
export function describeDbFailure(error: unknown): DbFailure {
  const e: PgErrorLike = typeof error === "string" ? { message: error } : (error ?? {});
  const message = typeof e.message === "string" ? e.message : "";
  const sqlState = typeof e.code === "string" ? e.code : undefined;

  const akm = message.match(/AKM_[A-Z_]+/)?.[0];
  if (akm && AKM[akm]) return { ...AKM[akm], sqlState };

  // PostgREST cannot even find the function in its schema cache.
  if (sqlState === "PGRST202" || sqlState === "PGRST203") {
    return { ...SERVER_TRY_AGAIN, reason: "MISSING_DB_FUNCTION", sqlState };
  }
  // Postgres: undefined_function / undefined_table → a migration was not applied to this project.
  if (sqlState === "42883" || /function .* does not exist/i.test(message)) {
    return { ...SERVER_TRY_AGAIN, reason: "MISSING_DB_FUNCTION", sqlState };
  }
  if (sqlState === "42P01" || /relation .* does not exist/i.test(message)) {
    return { ...SERVER_TRY_AGAIN, reason: "MISSING_DB_TABLE", sqlState };
  }
  // Postgres: insufficient_privilege — a GRANT is missing for service_role/authenticated.
  if (sqlState === "42501" || /permission denied/i.test(message)) {
    return { ...SERVER_TRY_AGAIN, reason: "MISSING_GRANT", sqlState };
  }
  // Check constraint (phone format, non-negative money, status enum).
  if (sqlState === "23514") {
    if (/phone/i.test(message)) {
      return { status: 400, kind: "validation", code: "VALIDATION", error: PHONE_MESSAGE, reason: "PHONE_CONSTRAINT", sqlState };
    }
    return { status: 422, kind: "validation", code: "VALIDATION", error: "Some order details aren't valid. Please check the form and try again.", reason: "CHECK_CONSTRAINT", sqlState };
  }
  // Foreign key (governorate removed, variant deleted mid-checkout).
  if (sqlState === "23503") {
    return { status: 422, kind: "validation", code: "VALIDATION", error: "Some of those details are no longer valid. Please refresh and try again.", reason: "FOREIGN_KEY", sqlState };
  }
  // Unique violation: an order-number collision (retry with the same idempotency key) or a replayed key.
  if (sqlState === "23505") {
    if (/order_number/i.test(message)) return { status: 503, kind: "server", code: "AKM_RETRY", error: "Please press Place order once more.", reason: "ORDER_NUMBER_COLLISION", sqlState };
    return { ...SERVER_TRY_AGAIN, reason: "UNIQUE_VIOLATION", sqlState };
  }
  // Bad cast (invalid uuid, malformed JSON value).
  if (sqlState === "22P02" || /invalid input syntax/i.test(message)) {
    return { status: 400, kind: "validation", code: "VALIDATION", error: "Something in the form was not readable. Please refresh the page and try again.", reason: "BAD_CAST", sqlState };
  }
  // Serialization / deadlock under concurrency: safe to retry.
  if (sqlState === "40001" || sqlState === "40P01" || /deadlock|could not serialize/i.test(message)) {
    return { status: 503, kind: "server", code: "AKM_RETRY", error: "The store was busy. Please press Place order once more.", reason: "CONCURRENCY", sqlState };
  }
  if (/orders_phone_check/i.test(message) || /phone/i.test(message)) {
    return { status: 400, kind: "validation", code: "VALIDATION", error: PHONE_MESSAGE, reason: "PHONE_CONSTRAINT", sqlState };
  }
  return { ...SERVER_TRY_AGAIN, reason: "UNKNOWN", sqlState };
}

/** Everything an operator needs to fix the problem, with customer PII kept out of the log. */
export function logDetail(error: unknown): Record<string, unknown> {
  if (typeof error === "string") return { message: truncate(error) };
  const e = (error ?? {}) as PgErrorLike & { name?: unknown };
  return {
    name: typeof e.name === "string" ? e.name : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    message: typeof e.message === "string" ? truncate(e.message) : undefined,
    // `details` can echo row values (phone, address); keep only whether it exists.
    hasDetails: e.details != null,
    hint: typeof e.hint === "string" ? truncate(e.hint) : undefined,
  };
}

function truncate(s: string, max = 400) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function describeUnexpectedError(error: unknown): DbFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|network/i.test(message)) {
    return { status: 503, kind: "server", code: "AKM_RETRY", error: "We couldn't reach the store just now. Please press Place order once more.", reason: "UPSTREAM_UNAVAILABLE" };
  }
  return { ...SERVER_TRY_AGAIN, reason: "UNEXPECTED" };
}
