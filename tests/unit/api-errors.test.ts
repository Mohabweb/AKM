import { describe, expect, it } from "vitest";
import { describeDbFailure, describeUnexpectedError, logDetail } from "@/lib/api-errors";

const pg = (code: string, message: string, extra: Record<string, unknown> = {}) => ({ code, message, ...extra });

describe("describeDbFailure — known business errors", () => {
  it("maps stock problems so the customer can act", () => {
    const out = describeDbFailure(pg("P0001", "AKM_OUT_OF_STOCK:abc:2"));
    expect(out).toMatchObject({ kind: "out_of_stock", status: 409, code: "AKM_OUT_OF_STOCK", reason: "OUT_OF_STOCK" });
    expect(out.error).toMatch(/no longer available/i);
  });

  it("maps every documented AKM_* exception to a customer-safe message", () => {
    const codes = [
      "AKM_UNAVAILABLE:id", "AKM_COUPON_INVALID:expired", "AKM_BAD_GOVERNORATE", "AKM_PAYMENT_DISABLED",
      "AKM_BAD_QTY:id", "AKM_EMPTY_CART", "AKM_RECEIPT_NOT_ALLOWED", "AKM_ORDER_NOT_FOUND", "AKM_FORBIDDEN", "AKM_NOT_FOUND",
    ];
    for (const c of codes) {
      const out = describeDbFailure(pg("P0001", c));
      expect(out.reason, c).not.toBe("UNKNOWN");
      expect(out.error, c).not.toMatch(/AKM_|SQL|postgres|pgcrypto/i);
    }
  });

  it("asks for a retry when the order number collides", () => {
    expect(describeDbFailure(pg("P0001", "AKM_RETRY"))).toMatchObject({ status: 503, code: "AKM_RETRY" });
  });
});

describe("describeDbFailure — operational failures stay generic to the customer", () => {
  it("recognises the pgcrypto/search_path bug that broke checkout", () => {
    // This is the exact error the hosted project returned for COD and InstaPay orders.
    const out = describeDbFailure(pg("42883", "function gen_random_bytes(integer) does not exist", { hint: "No function matches" }));
    expect(out).toMatchObject({ kind: "server", status: 500, reason: "MISSING_DB_FUNCTION", sqlState: "42883" });
    expect(out.error).not.toMatch(/gen_random_bytes|42883/);
  });

  it("recognises a missing migration (PostgREST schema cache) and a missing table", () => {
    expect(describeDbFailure(pg("PGRST202", "Could not find the function public.set_order_status")).reason).toBe("MISSING_DB_FUNCTION");
    expect(describeDbFailure(pg("42P01", 'relation "public.orders" does not exist')).reason).toBe("MISSING_DB_TABLE");
  });

  it("recognises a missing grant for the server role", () => {
    const out = describeDbFailure(pg("42501", "permission denied for function create_order"));
    expect(out).toMatchObject({ kind: "server", reason: "MISSING_GRANT" });
    expect(out.error).not.toMatch(/permission denied/i);
  });

  it("never leaks database internals in the customer message", () => {
    const samples = [
      pg("42883", "function gen_random_bytes(integer) does not exist"),
      pg("42501", "permission denied for table orders"),
      pg("23505", 'duplicate key value violates unique constraint "orders_pkey"', { details: "Key (id)=(...) already exists." }),
      pg("XX000", "internal error: something exploded"),
    ];
    for (const s of samples) {
      const out = describeDbFailure(s);
      expect(out.kind).toBe("server");
      expect(out.error).not.toMatch(/AKM_|function |permission|constraint|postgres|duplicate|gen_random/i);
    }
  });
});

describe("describeDbFailure — customer-correctable validation failures", () => {
  it("maps the phone check constraint to a phone message", () => {
    const out = describeDbFailure(pg("23514", 'new row for relation "orders" violates check constraint "orders_phone_check"'));
    expect(out).toMatchObject({ kind: "validation", reason: "PHONE_CONSTRAINT" });
    expect(out.error).toMatch(/Egyptian mobile number/);
  });

  it("maps a removed governorate or variant to a refresh message", () => {
    expect(describeDbFailure(pg("23503", "insert or update violates foreign key constraint")).kind).toBe("validation");
  });

  it("maps malformed ids and deadlocks", () => {
    expect(describeDbFailure(pg("22P02", 'invalid input syntax for type uuid: "x"')).reason).toBe("BAD_CAST");
    expect(describeDbFailure(pg("40P01", "deadlock detected"))).toMatchObject({ status: 503, code: "AKM_RETRY" });
  });

  it("accepts a bare message string for backwards compatibility", () => {
    expect(describeDbFailure("AKM_OUT_OF_STOCK:v:0").kind).toBe("out_of_stock");
    expect(describeDbFailure("some unknown failure")).toMatchObject({ kind: "server", reason: "UNKNOWN" });
  });
});

describe("describeUnexpectedError", () => {
  it("turns a network failure into a retry message", () => {
    expect(describeUnexpectedError(new Error("fetch failed"))).toMatchObject({ status: 503, code: "AKM_RETRY", reason: "UPSTREAM_UNAVAILABLE" });
  });
  it("is generic otherwise", () => {
    const out = describeUnexpectedError(new Error("undefined is not a function"));
    expect(out.reason).toBe("UNEXPECTED");
    expect(out.error).not.toMatch(/undefined is not a function/);
  });
});

describe("logDetail", () => {
  it("keeps the operator detail and drops anything that could echo customer data", () => {
    const d = logDetail(pg("23514", "phone check failed", { details: "Failing row contains (01012345678, 12 Some Street)." }));
    expect(d).toMatchObject({ code: "23514", hasDetails: true });
    expect(JSON.stringify(d)).not.toContain("01012345678");
  });
});
