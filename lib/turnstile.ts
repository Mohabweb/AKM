import "server-only";
import { serverEnv } from "@/lib/env.server";

/** Verifies a Cloudflare Turnstile token. When no secret is configured the check is skipped (documented in README). */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!serverEnv.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: serverEnv.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
