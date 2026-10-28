import "server-only";
import { serverEnv } from "@/lib/env.server";

/** Verifies a Cloudflare Turnstile token.
 *  When keys are empty in development/test the check is skipped so local checkout works.
 *  Production without a secret also skips (and logs) so a missing env var cannot brick every order. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!serverEnv.TURNSTILE_SECRET_KEY) {
    if (serverEnv.NODE_ENV === "production") {
      console.error("[turnstile] TURNSTILE_SECRET_KEY is empty; skipping verification");
    }
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: serverEnv.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (e) {
    console.error("[turnstile] siteverify failed", (e as Error).message);
    return false;
  }
}
