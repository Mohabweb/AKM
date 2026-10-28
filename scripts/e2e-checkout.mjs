#!/usr/bin/env node
/**
 * End-to-end checkout check against a running server.
 *   node scripts/e2e-checkout.mjs             # COD
 *   node scripts/e2e-checkout.mjs --instapay  # InstaPay + receipt upload
 *
 * Adds a real in-stock variant through the product page, fills the checkout form like a
 * customer, and reports every step. It never invents products or prices.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, "")]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];
function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function rest(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`REST ${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const instapay = process.argv.includes("--instapay");
  const products = await rest("storefront_products?select=slug,name&in_stock=is.true&order=sold_count.desc&limit=5");
  if (!products.length) throw new Error("no published in-stock product found");
  const product = products[0];
  console.log(`Product: ${product.name} (/product/${product.slug})\n`);

  // Use the installed Chrome when Playwright's own browser build is absent.
  const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/product/${product.slug}`, { waitUntil: "domcontentloaded" });
  const size = page.locator('div[role="radiogroup"][aria-label="Size"] button:not([disabled])').first();
  await size.waitFor({ timeout: 20000 });
  await size.click();
  step("product page: size selectable", true);
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.waitForTimeout(600);
  step("add to cart", true);

  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await page.locator("#co-customerName").waitFor({ timeout: 20000 });
  await page.fill("#co-customerName", "E2E Test Customer");
  await page.fill("#co-phone", "01012345678");
  const gov = page.locator("#co-governorateId");
  await gov.waitFor();
  const govValue = await gov.locator("option").nth(1).getAttribute("value");
  await gov.selectOption(govValue);
  await page.fill("#co-city", "Alexandria");
  await page.fill("#co-area", "Smouha");
  await page.fill("#co-address", "12 Test Street, building 3");
  await page.fill("#co-landmark", "Next to the pharmacy");
  await page.locator('input[name="pm"]').nth(instapay ? 1 : 0).check();
  step("checkout form filled", true);
  await page.getByRole("button", { name: "Place order" }).first().waitFor({ state: "visible" });

  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/checkout"), { timeout: 60000 }),
    page.locator("aside").getByRole("button", { name: "Place order" }).click(),
  ]);
  const body = await res.json().catch(() => ({}));
  step(`POST /api/checkout -> ${res.status()}`, res.ok(), JSON.stringify(body).slice(0, 300));

  if (!res.ok()) {
    console.log("Non-OK response body:", JSON.stringify(body));
    const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);
    step("customer sees a specific message", Boolean(alert && alert.trim()), (alert ?? "(no alert)").trim());
    step("stayed on checkout", page.url().includes("/checkout"), page.url());
    await page.screenshot({ path: "screens/checkout-error.png" }).catch(() => {});
    await browser.close();
    return finish();
  }

  const orderNumber = body.orderNumber;
  await page.waitForURL(`**/order/${orderNumber}**`, { timeout: 30000 });
  step("redirected to the confirmation page", true, orderNumber);
  await page.waitForTimeout(1500);
  const confText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  step("order number shown on confirmation", confText.includes(orderNumber));
  step("confirmation has no error banner", !/Something went wrong|couldn't/i.test(confText));

  if (instapay) {
    const upload = await page.evaluate(async (num) => {
      const canvas = document.createElement("canvas");
      canvas.width = 60; canvas.height = 60;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 60, 60);
      ctx.fillStyle = "#1395A4"; ctx.fillRect(10, 10, 40, 40);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const fd = new FormData();
      fd.append("orderNumber", num);
      fd.append("phone", "01012345678");
      fd.append("file", new File([blob], "receipt.png", { type: "image/png" }));
      const res = await fetch("/api/receipt", { method: "POST", body: fd });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    }, orderNumber);
    step(`POST /api/receipt -> ${upload.status}`, upload.status === 200, JSON.stringify(upload.body).slice(0, 200));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const after = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    step("order confirms the receipt is awaiting review", /verif|review|receipt/i.test(after));
  }

  if (consoleErrors.length) console.log("\nBrowser console errors:\n" + consoleErrors.join("\n"));
  await browser.close();
  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failed: " + failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error("E2E error:", e.message); process.exitCode = 1; });
