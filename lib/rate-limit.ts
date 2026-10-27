import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serviceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env.server";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

const hash = (v: string) => createHash("sha256").update(serverEnv.RATE_LIMIT_SALT + v).digest("hex").slice(0, 32);

/** true = allowed. Identifiers are hashed before they reach the database. Fails CLOSED if the limiter errors. */
export async function allow(scope: string, id: string, windowSeconds: number, max: number): Promise<boolean> {
  const { data, error } = await serviceClient().rpc("rate_limit_hit", {
    p_key: `${scope}:${hash(id)}`,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("rate_limit_hit failed", error.message);
    return false;
  }
  return data === true;
}
