#!/usr/bin/env node
/**
 * Verifies the hosted Supabase project has everything checkout, tracking and receipt upload need.
 * Read-only for customer data: the only write probe uses an invalid phone number, so the order
 * insert fails at the phone constraint and nothing is created.
 *
 *   node scripts/check-db.mjs
 *
 * Exit code 0 only when every check passes.
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, "")]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const rows = [];
function check(name, ok, detail) {
  rows.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function rpc(fn, args) {
  const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args ?? {}) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const errOf = (b) => (b && typeof b === "object" && b.message ? `${b.code ?? "?"} ${b.message}` : String(b));

async function main() {
  console.log(`Project: ${URL_BASE}\n`);
  if (!URL_BASE || !KEY) {
    check("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set", false, ".env.local");
    return finish();
  }
  check("service role key present", KEY.length > 20, `${KEY.length} chars`);

  // --- read paths the storefront relies on
  const zones = await fetch(`${URL_BASE}/rest/v1/shipping_zones?select=id,governorate,fee_piasters&is_active=is.true&limit=1`, { headers });
  check("shipping_zones readable", zones.ok, zones.ok ? "" : zones.status);
  const settings = await fetch(`${URL_BASE}/rest/v1/settings?select=key&key=eq.payment_methods_enabled`, { headers });
  const settingsRows = settings.ok ? await settings.json() : [];
  check("payment_methods_enabled setting exists", settingsRows.length === 1);

  // --- functions the API calls
  const rl = await rpc("rate_limit_hit", { p_key: `checkdb:${Date.now()}`, p_window_seconds: 60, p_max: 5 });
  check("rate_limit_hit executes", rl.status === 200, errOf(rl.body));

  const q = await rpc("quote_cart", { p: { items: [] } });
  check("quote_cart executes", q.status === 200 && q.body && Array.isArray(q.body.lines), errOf(q.body));

  const num = await rpc("gen_order_number");
  check("gen_order_number executes", num.status === 200, errOf(num.body));
  check("order numbers match AKM-XXXXXX", /^AKM-[0-9A-HJKMNP-TV-Z]{6}$/.test(String(num.body)), String(num.body));

  const track = await rpc("track_order", { p_number: "AKM-ZZZZZZ", p_phone: "01012345678" });
  check("track_order executes", track.status === 200, errOf(track.body));

  const receipt = await rpc("attach_receipt", { p_order: "00000000-0000-4000-8000-000000000000", p_path: "x/y.jpg" });
  check("attach_receipt executes", /AKM_ORDER_NOT_FOUND/.test(JSON.stringify(receipt.body)), errOf(receipt.body));

  const review = await rpc("review_receipt", { p_receipt: "00000000-0000-4000-8000-000000000000", p_approve: true, p_note: null });
  check("review_receipt executes", review.status !== 404, errOf(review.body));

  const setStatus = await rpc("set_order_status", { p_order: "00000000-0000-4000-8000-000000000000", p_to: "paid", p_note: null });
  check("set_order_status executes", setStatus.status !== 404, errOf(setStatus.body));

  // --- the exact insert path that broke checkout: a real in-stock variant plus an invalid phone number.
  // The order insert runs (and therefore evaluates the order-number default), then fails on the phone
  // check constraint, so nothing is created.
  const zone = zones.ok ? (await zones.json())[0]?.id : null;
  const variants = await fetch(`${URL_BASE}/rest/v1/public_variants?select=id&in_stock=is.true&limit=1`, { headers });
  const variantId = variants.ok ? (await variants.json())[0]?.id : null;
  let create = { status: 0, body: "no zone/variant" };
  if (zone && variantId) {
    create = await rpc("create_order", {
      p: {
        idempotency_key: crypto.randomUUID(), payment_method: "cod", customer_name: "DB Check", phone: "12345",
        governorate_id: zone, city: "Alexandria", area: "Smouha", address: "1 Check Street", landmark: "Test",
        items: [{ variant_id: variantId, qty: 1 }],
      },
    });
  }
  const createErr = errOf(create.body);
  const reachedInsert = /23514|phone|violates check constraint/i.test(createErr);
  check(
    "create_order reaches the order insert (order-number default works)",
    create.status !== 404 && !/42883|gen_random_bytes|function .* does not exist/i.test(createErr),
    createErr,
  );
  check(
    "create_order rejects an invalid phone at the database (expected)",
    reachedInsert,
    createErr,
  );

  // --- storage buckets (receipt upload + product images)
  const bucketRes = await fetch(`${URL_BASE}/storage/v1/bucket`, { headers });
  if (bucketRes.ok) {
    const buckets = await bucketRes.json();
    const byId = Object.fromEntries(buckets.map((b) => [b.id, b]));
    check("instapay-receipts bucket exists and is private", byId["instapay-receipts"]?.public === false);
    check("product-images bucket exists and is public", byId["product-images"]?.public === true);
  } else {
    check("storage buckets readable", false, bucketRes.status);
  }

  finish();
}

function finish() {
  const failed = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - failed.length}/${rows.length} checks passed`);
  if (failed.length) {
    console.log("\nFix these first:");
    for (const f of failed) console.log(` - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error("check-db error:", e.message); process.exitCode = 1; });
