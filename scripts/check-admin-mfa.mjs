#!/usr/bin/env node
/**
 * End-to-end check of the admin two-factor flow against the real project.
 *
 * Signs a throwaway owner into the real login page in Chrome and drives the actual UI:
 *   1. first login shows a scannable QR code and a manual secret
 *   2. reloading the setup page replaces the unfinished enrollment instead of dead-ending
 *   3. the code from the *replaced* entry is reported as a code mismatch (not a crash)
 *   4. "Generate a new QR code" + the code from the newest entry activates 2FA
 *   5. the next sign-in asks for the code on /admin/mfa-verify and accepts the same entry
 *   6. exactly one verified factor is left on the account
 *
 * The temporary admin (auth user + admin_users row) is deleted in every exit path.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, a running dev server, Chrome.
 *   npm run check:mfa            (E2E_BASE / E2E_CHANNEL to override)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

if (!URL || !SVC) {
  console.log("FAIL  set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

/** RFC 6238 (SHA1, 6 digits, 30s) — the same code Google Authenticator shows. */
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const i = alphabet.indexOf(ch);
    if (i >= 0) bits += i.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, at = Date.now()) {
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const admin = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `mfa-check-${Date.now()}@example.com`;
const password = `Check!${crypto.randomUUID().slice(0, 12)}`;

const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (createErr || !created?.user) {
  console.log("FAIL  could not create the temporary admin:", createErr?.message);
  process.exit(1);
}
const uid = created.user.id;
const { error: adminErr } = await admin.from("admin_users").insert({ user_id: uid, email, role: "owner" });
if (adminErr) {
  await admin.auth.admin.deleteUser(uid);
  console.log("FAIL  could not attach admin_users row:", adminErr.message);
  process.exit(1);
}
console.log(`Temporary owner: ${email}\n`);

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome" }).catch(() => chromium.launch());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const secretOnPage = async () => (await page.locator("code").first().textContent({ timeout: 20000 })).trim();
const signIn = async () => {
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
};

try {
  await signIn();
  await page.waitForURL(/mfa-enroll/, { timeout: 30000 });
  const secretA = await secretOnPage();
  check("first login shows a QR code and manual secret", !!secretA);

  await page.reload({ waitUntil: "networkidle" });
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const secretB = await secretOnPage().catch(() => null);
  check("reloading the setup page does not dead-end", !/Setup Failed/i.test(body), secretB ? "new QR shown" : "no QR");
  check("the replaced enrollment is explained", /Unfinished setup replaced/i.test(body));
  check("the reload issued a new pending secret", !!secretB && secretB !== secretA);

  await page.fill("#code", totp(secretA));
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  const errorText = (await page.locator('[role="alert"]').first().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("a stale authenticator entry is reported as a code mismatch", /didn.t match/i.test(errorText), errorText.slice(0, 80));
  check("the admin stays on the setup page with a retry path", /mfa-enroll/.test(page.url()));

  await page.getByRole("button", { name: /Generate a new QR code/i }).click();
  await page.waitForFunction(
    (previous) => {
      const el = document.querySelector("code");
      return !!el && el.textContent.trim().length > 0 && el.textContent.trim() !== previous;
    },
    secretB,
    { timeout: 25000 },
  );
  const secretC = await secretOnPage();
  check("'Generate a new QR code' issues a fresh secret", secretC !== secretB);

  await page.fill("#code", totp(secretC));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/orders/, { timeout: 30000 }).catch(() => {});
  check("the newest code activates 2FA and enters the dashboard", /\/admin\/orders/.test(page.url()), page.url());

  await context.clearCookies();
  await signIn();
  await page.waitForURL(/mfa-verify/, { timeout: 30000 }).catch(() => {});
  check("the next sign-in asks for the code", /mfa-verify/.test(page.url()), page.url());
  await page.fill("#code", totp(secretC));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin\/orders/, { timeout: 30000 }).catch(() => {});
  check("the verification page accepts the same authenticator", /\/admin\/orders/.test(page.url()), page.url());

  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: uid });
  const statuses = (factors?.factors ?? []).map((f) => f.status);
  check("exactly one verified factor is left on the account", statuses.length === 1 && statuses[0] === "verified", JSON.stringify(statuses));
} catch (error) {
  check("the flow ran to completion", false, error.message);
  await page.screenshot({ path: "mfa-check-failure.png" }).catch(() => {});
} finally {
  await browser.close();
  await admin.from("admin_users").delete().eq("user_id", uid);
  await admin.auth.admin.deleteUser(uid);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
}
