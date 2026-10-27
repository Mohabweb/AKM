import { json } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { getProductsByIds } from "@/lib/catalog";

/** Public product cards by id (wishlist / recently viewed). Published products only: the view enforces it. */
export async function GET(req: Request) {
  if (!(await allow("products", await clientIp(), 60, 60))) return json({ error: "Too many requests" }, 429);
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").slice(0, 24);
  return json({ products: await getProductsByIds(ids) });
}
