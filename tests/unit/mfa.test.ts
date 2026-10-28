import { describe, expect, it } from "vitest";
import { describeMfaFailure, hasVerifiedTotp, totpFactors } from "@/lib/mfa";

const authError = (code: string, message = "") => ({ code, message, status: 422, name: "AuthApiError" });
const factor = (status: string, factor_type = "totp", id = "f1") => ({ id, status, factor_type });

describe("totpFactors — pending enrollments live in `all`, not in the `totp` bucket", () => {
  // auth-js `_listFactors` only fills `totp` with verified factors. Reading `.totp` therefore hid an
  // unfinished enrollment, so cleanup was skipped and every enroll failed with mfa_factor_name_conflict.
  it("finds an unverified factor that only appears in `all`", () => {
    const list = { all: [factor("unverified")], totp: [] };
    expect(totpFactors(list)).toHaveLength(1);
    expect(hasVerifiedTotp(list)).toBe(false);
  });

  it("detects a verified factor and ignores non-TOTP factors", () => {
    const list = { all: [factor("verified"), factor("verified", "webauthn", "w1")], totp: [factor("verified")] };
    expect(totpFactors(list).map((f) => f.id)).toEqual(["f1"]);
    expect(hasVerifiedTotp(list)).toBe(true);
  });

  it("is empty and safe for a missing list", () => {
    expect(totpFactors(null)).toEqual([]);
    expect(hasVerifiedTotp(undefined)).toBe(false);
  });
});

describe("describeMfaFailure — the admin can always act on the message", () => {
  it("treats a wrong code as a code problem, not a broken setup", () => {
    const out = describeMfaFailure(authError("mfa_verification_failed", "Invalid TOTP code entered"));
    expect(out).toMatchObject({ kind: "code", reason: "BAD_CODE", restart: false });
    // Points at the two real causes: the entry in the app and the phone clock.
    expect(out.error).toMatch(/date and time/i);
    expect(out.error).toMatch(/AKM Luxury Shoes/);
  });

  it("never shows raw Supabase codes or messages to the admin", () => {
    const samples = [
      authError("mfa_verification_failed", "Invalid TOTP code entered"),
      authError("mfa_factor_name_conflict", 'A factor with the friendly name "x@y.z" for this user already exists'),
      authError("mfa_factor_not_found", "Factor not found"),
      authError("session_not_found", "Auth session missing!"),
      authError("insufficient_aal", "AAL2 required to enroll"),
      {},
    ];
    for (const s of samples) {
      const out = describeMfaFailure(s);
      // "two-factor" is fine for humans; internal codes/messages are not.
      expect(out.error).not.toMatch(/mfa_|\baal\b|jwt|token|fact found|friendly name/i);
      expect(out.reason).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it("marks setup failures that a reload can fix", () => {
    expect(describeMfaFailure(authError("mfa_factor_name_conflict", "already exists"))).toMatchObject({
      kind: "setup",
      reason: "DUPLICATE_SETUP",
      restart: true,
    });
    expect(describeMfaFailure(authError("mfa_factor_not_found", "Factor not found"))).toMatchObject({
      reason: "FACTOR_NOT_FOUND",
      restart: true,
    });
  });

  it("does not tell the admin to reload when the session is the problem", () => {
    for (const code of ["session_not_found", "invalid_jwt", "bad_jwt", "insufficient_aal"]) {
      const out = describeMfaFailure(authError(code));
      expect(out.kind, code).toBe("session");
      expect(out.restart, code).toBe(false);
      expect(out.error).toMatch(/sign in again/i);
    }
  });

  it("recognises an expired challenge and rate limiting", () => {
    expect(describeMfaFailure(authError("mfa_challenge_expired"))).toMatchObject({ reason: "CHALLENGE_EXPIRED", restart: false });
    expect(describeMfaFailure(authError("over_request_rate_limit", "Too many requests"))).toMatchObject({ reason: "RATE_LIMITED" });
  });

  it("falls back to a retryable message for unknown failures", () => {
    const out = describeMfaFailure(new Error("boom"));
    expect(out).toMatchObject({ kind: "setup", reason: "UNKNOWN", restart: true });
    expect(out.error).toMatch(/reload/i);
  });
});
