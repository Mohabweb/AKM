import { json } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { anonClient } from "@/lib/supabase/anon";

export async function GET(req: Request) {
  if (!(await allow("search", await clientIp(), 60, 90))) return json({ error: "Too many requests" }, 429);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return json({ products: [], brands: [] });
  const { data, error } = await anonClient().rpc("search_suggest", { p_q: q });
  if (error) return json({ products: [], brands: [] }, 500);
  return json(data);
}
