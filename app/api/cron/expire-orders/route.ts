import { json } from "@/lib/api";
import { serverEnv } from "@/lib/env.server";
import { serviceClient } from "@/lib/supabase/service";

/** Vercel Cron → cancels unpaid card/InstaPay orders past the configured window and returns their stock. */
export async function GET(req: Request) {
  if (!serverEnv.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${serverEnv.CRON_SECRET}`) return json({ error: "unauthorized" }, 401);
  const { data, error } = await serviceClient().rpc("expire_unpaid_orders", {});
  if (error) return json({ error: "failed" }, 500);
  return json({ expired: data });
}
