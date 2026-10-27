import { describe, expect, it } from "vitest";
import { formatEGP, parseEGP, percentOff } from "@/lib/money";
import { checkoutSchema, normalizePhone, phoneSchema, orderNumberSchema } from "@/lib/validation";
import { paymobHmac, verifyPaymobHmac } from "@/lib/payments/paymob";

describe("money", () => {
  it("formats whole and fractional EGP", () => {
    expect(formatEGP(100000)).toMatch(/1,000/);
    expect(formatEGP(125050)).toMatch(/1,250\.50/);
  });
  it("parses text without float math", () => {
    expect(parseEGP("1,250.5")).toBe(125050);
    expect(parseEGP("19.99")).toBe(1999);
    expect(parseEGP("0.1")).toBe(10);
    expect(parseEGP("abc")).toBeNull();
    expect(parseEGP("1.234")).toBeNull();
    expect(parseEGP("-5")).toBeNull();
  });
  it("computes integer discount percent", () => {
    expect(percentOff(140000, 100000)).toBe(29);
    expect(percentOff(100, 100)).toBe(0);
    expect(percentOff(0, 0)).toBe(0);
  });
});

describe("phone and order number validation", () => {
  it("accepts Egyptian mobiles and normalizes prefixes", () => {
    for (const ok of ["01012345678", "01112345678", "01212345678", "01512345678", "+201012345678", "0020 101 234 5678", "010-1234-5678"])
      expect(phoneSchema.safeParse(ok).success, ok).toBe(true);
    expect(normalizePhone("+201012345678")).toBe("01012345678");
  });
  it("rejects everything else", () => {
    for (const bad of ["01312345678", "0101234567", "010123456789", "02012345678", "abc", ""]) expect(phoneSchema.safeParse(bad).success, bad).toBe(false);
  });
  it("matches the generated order number alphabet", () => {
    expect(orderNumberSchema.safeParse("akm-7k3q9f").success).toBe(true);
    expect(orderNumberSchema.safeParse("AKM-7K3Q9I").success).toBe(false); // I is never generated
    expect(orderNumberSchema.safeParse("AKM-7K3Q9").success).toBe(false);
  });
});

describe("checkout schema", () => {
  const base = {
    idempotencyKey: crypto.randomUUID(), items: [{ variantId: crypto.randomUUID(), qty: 1 }], customerName: "Ali Hassan",
    phone: "01012345678", governorateId: crypto.randomUUID(), city: "Alexandria", area: "Smouha", address: "12 Some Street", landmark: "Near tram",
    paymentMethod: "cod",
  };
  it("accepts a valid order and ignores client-sent prices", () => {
    const r = checkoutSchema.parse({ ...base, total: 1, unitPrice: 1 });
    expect(r).not.toHaveProperty("total");
    expect(r).not.toHaveProperty("unitPrice");
  });
  it("rejects bad quantities and empty carts", () => {
    for (const qty of [0, -1, 11, 1.5]) expect(checkoutSchema.safeParse({ ...base, items: [{ variantId: base.items[0].variantId, qty }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });
  it("requires a landmark and a valid phone", () => {
    expect(checkoutSchema.safeParse({ ...base, landmark: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
  });
});

describe("paymob hmac", () => {
  const obj = {
    amount_cents: 206000, created_at: "2026-10-25T19:00:00.000000", currency: "EGP", error_occured: false, has_parent_transaction: false,
    id: 123, integration_id: 456, is_3d_secure: true, is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true,
    is_voided: false, order: { id: 789 }, owner: 1, pending: false, source_data: { pan: "2346", sub_type: "MasterCard", type: "card" }, success: true,
  };
  it("concatenates in the documented order and verifies", () => {
    const secret = "test-secret";
    const sig = paymobHmac(obj, secret);
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    expect(verifyPaymobHmac(obj, sig, secret)).toBe(true);
  });
  it("rejects tampering, wrong secret and missing signature", () => {
    const sig = paymobHmac(obj, "s");
    expect(verifyPaymobHmac({ ...obj, amount_cents: 1 }, sig, "s")).toBe(false);
    expect(verifyPaymobHmac(obj, sig, "other")).toBe(false);
    expect(verifyPaymobHmac(obj, null, "s")).toBe(false);
    expect(verifyPaymobHmac(obj, "zz", "s")).toBe(false);
  });
});
