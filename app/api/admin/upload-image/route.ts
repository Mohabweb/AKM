import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { json } from "@/lib/api";
import { getAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

function sniff(b: Uint8Array): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return json({ error: "Unauthorized: admin privileges required." }, 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Invalid form data." }, 400);
  }

  const productId = form.get("productId") as string;
  const file = form.get("file");

  if (!productId || !(file instanceof File)) {
    return json({ error: "Missing productId or image file." }, 400);
  }

  if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    return json({ error: "File must be an image under 5 MB." }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) {
    return json({ error: "File must be a valid WebP, JPEG, or PNG image (checked by magic bytes)." }, 415);
  }

  const sb = await sessionClient();
  const filename = `${randomUUID()}.${kind.ext}`;
  const storagePath = `${productId}/${filename}`;

  const { error: uploadErr } = await sb.storage
    .from("product-images")
    .upload(storagePath, bytes, {
      contentType: kind.mime,
      upsert: false,
    });

  if (uploadErr) {
    return json({ error: `Upload failed: ${uploadErr.message}` }, 500);
  }

  const { data: publicUrlData } = sb.storage
    .from("product-images")
    .getPublicUrl(storagePath);

  // Get current max sort_order
  const { data: existingImages } = await sb
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

  const { data: imageRow, error: dbErr } = await sb
    .from("product_images")
    .insert({
      product_id: productId,
      url: publicUrlData.publicUrl,
      sort_order: nextOrder,
    })
    .select("id, url, sort_order")
    .single();

  if (dbErr) {
    return json({ error: `Failed to record image: ${dbErr.message}` }, 500);
  }

  updateTag("catalog");

  return json({
    ok: true,
    image: imageRow,
  });
}
