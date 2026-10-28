/**
 * Pure mapping from Supabase Auth MFA failures to (a) a message the admin can act on and
 * (b) a stable reason slug for the server log. No "server-only" import so it stays unit-testable.
 */

export type MfaFailureKind = "code" | "setup" | "session";

/**
 * `restart` means: reloading the setup page will produce a working QR code again, because the
 * pending factor is gone or gets replaced. The UI uses it to offer a way forward instead of a dead end.
 */
export type MfaFailure = { error: string; reason: string; kind: MfaFailureKind; restart: boolean };

type MfaErrorLike = { code?: unknown; message?: unknown; status?: unknown };

export type MfaFactor = { id: string; status: string; factor_type?: string; friendly_name?: string };

/** What `supabase.auth.mfa.listFactors()` returns: `all` holds every factor, the per-type buckets only verified ones. */
export type MfaFactorList = { all?: MfaFactor[]; totp?: MfaFactor[] } | null | undefined;

/**
 * Every TOTP factor, verified or not.
 * `listFactors()` only fills its `totp` bucket with *verified* factors (see auth-js `_listFactors`),
 * so a pending enrollment is visible exclusively in `all`. Reading `.totp` here silently hid pending
 * factors and made re-enrollment fail with `mfa_factor_name_conflict`.
 */
export function totpFactors(list: MfaFactorList): MfaFactor[] {
  const all = list?.all ?? list?.totp ?? [];
  return all.filter((f) => (f.factor_type ?? "totp") === "totp");
}

export function hasVerifiedTotp(list: MfaFactorList): boolean {
  return totpFactors(list).some((f) => f.status === "verified");
}

const SESSION_EXPIRED: MfaFailure = {
  kind: "session",
  reason: "SESSION_EXPIRED",
  restart: false,
  error: "Your session expired. Please sign in again.",
};

const RESTART_HINT = " Reload this page to show a fresh QR code and set it up again.";

export function describeMfaFailure(error: unknown): MfaFailure {
  const e: MfaErrorLike = typeof error === "string" ? { message: error } : ((error ?? {}) as MfaErrorLike);
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";

  // Wrong, reused or too-late one-time code — the admin can fix this themselves.
  if (code === "mfa_verification_failed" || /invalid (totp|code)|code.*(invalid|expired)/i.test(message)) {
    return {
      kind: "code",
      reason: "BAD_CODE",
      restart: false,
      error:
        "That code didn't match. Make sure your phone's date and time are set automatically, then enter the code your app shows for AKM Luxury Shoes right now.",
    };
  }
  if (code === "mfa_challenge_expired") {
    return {
      kind: "code",
      reason: "CHALLENGE_EXPIRED",
      restart: false,
      error: "That code expired before it reached us. Enter the code your app is showing now.",
    };
  }
  // The factor the form was pointing at no longer exists (another tab replaced it, or it was removed).
  if (code === "mfa_factor_not_found") {
    return {
      kind: "setup",
      reason: "FACTOR_NOT_FOUND",
      restart: true,
      error: `This setup is no longer valid.${RESTART_HINT}`,
    };
  }
  // GoTrue refuses a second enroll while an unverified factor of the same friendly name exists.
  if (code === "mfa_factor_name_conflict" || /already exists/i.test(message)) {
    return {
      kind: "setup",
      reason: "DUPLICATE_SETUP",
      restart: true,
      error: `You already have an unfinished two-factor setup on this account.${RESTART_HINT}`,
    };
  }
  if (code === "mfa_verified_factor_exists") {
    return {
      kind: "setup",
      reason: "ALREADY_VERIFIED",
      restart: false,
      error: "Two-factor authentication is already active. Enter your code on the verification page.",
    };
  }
  if (code === "over_request_rate_limit" || /too many/i.test(message)) {
    return { kind: "code", reason: "RATE_LIMITED", restart: false, error: "Too many attempts. Please wait a minute and try again." };
  }
  // Session problems: the request never reached a usable session, so it is not a wrong code.
  if (code === "insufficient_aal" || /aal2|insufficient.*(aal|assurance)/i.test(message)) {
    return { ...SESSION_EXPIRED, reason: "NEEDS_AAL2", error: "Please sign in again to continue two-factor setup." };
  }
  if (
    code === "session_not_found" ||
    code === "invalid_jwt" ||
    code === "bad_jwt" ||
    /auth session missing|jwt expired|invalid jwt/i.test(message)
  ) {
    return SESSION_EXPIRED;
  }
  return {
    kind: "setup",
    reason: "UNKNOWN",
    restart: true,
    error: `We couldn't complete that step.${RESTART_HINT}`,
  };
}
