import { randomUUID } from "node:crypto";
import { dbError, failJson, json } from "@/lib/api";
import { allow, clientIp } from "@/lib/rate-limit";
import { serviceClient } from "@/lib/supabase/service";
import { orderNumberSchema, phoneSchema } from "@/lib/validation";

const MAX = 5 * 1024 * 1024;

/** Verifies file type by magic bytes (not the client-supplied MIME), then stores privately. */
function sniff(b: Uint8Array): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function POST(req: Request) {
  const ip = await clientIp();
  if (!(await allow("receipt-ip", ip, 3600, 10))) {
    return failJson("receipt", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many uploads. Please try again later." });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX + 10_000) {
    return failJson("receipt", { status: 413, kind: "validation", code: "VALIDATION", error: "File is too large (max 5 MB)." });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "Invalid upload." }, 400); }
  const num = orderNumberSchema.safeParse(form.get("orderNumber"));
  const phone = phoneSchema.safeParse(form.get("phone"));
  const file = form.get("file");
  if (!num.success || !phone.success || !(file instanceof File)) {
    return failJson("receipt", { status: 400, kind: "validation", code: "VALIDATION", error: "Missing order number, phone or file." }, {
      order: num.success, phone: phone.success, file: file instanceof File,
    });
  }
  if (file.size === 0 || file.size > MAX) {
    return failJson("receipt", { status: 413, kind: "validation", code: "VALIDATION", error: "File must be an image under 5 MB." });
  }
  if (!(await allow("receipt-order", num.data, 3600, 5))) {
    return failJson("receipt", { status: 429, kind: "rate_limit", code: "RATE_LIMIT", error: "Too many uploads for this order." });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return json({ error: "Please upload a JPG, PNG or WebP image." }, 415);

  const sb = serviceClient();
  const { data: tracked } = await sb.rpc("track_order", { p_number: num.data, p_phone: phone.data });
  if (!tracked) return json({ error: "We couldn't find an order matching those details." }, 404);
  const { data: order } = await sb.from("orders").select("id").eq("order_number", num.data).single();
  if (!order) return json({ error: "We couldn't find an order matching those details." }, 404);

  const path = `${order.id}/${randomUUID()}.${kind.ext}`; // random name; the bucket is private
  const up = await sb.storage.from("instapay-receipts").upload(path, bytes, { contentType: kind.mime, upsert: false });
  if (up.error) {
    return failJson("receipt", { status: 500, kind: "server", code: "ERROR", error: "Upload failed. Please try again." }, up.error.message);
  }
  const { error } = await sb.rpc("attach_receipt", { p_order: order.id, p_path: path });
  if (error) {
    await sb.storage.from("instapay-receipts").remove([path]);
    const e = dbError(error.message);
    if (e.code === "ERROR") e.error = "Upload failed. Please try again.";
    return failJson("receipt", e, { supabase: error.message, code: error.code });
  }
  return json({ ok: true });
}
