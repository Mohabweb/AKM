import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });
dotenv.config({ path: resolve(__dirname, "../.env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args[0] || process.env.OWNER_EMAIL || "owner@akmshoes.com";
const password = args[1] || process.env.OWNER_PASSWORD || "ChangeMeImmediately123!";

console.log(`\nBootstrapping owner account for: ${email}`);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  let userId;

  // 1. Check if user already exists
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("Failed to query auth users:", listErr.message);
    process.exit(1);
  }

  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    console.log(`Auth user already exists (id: ${userId}). Updating password...`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      console.error("Failed to update user password:", updErr.message);
      process.exit(1);
    }
  } else {
    console.log("Creating new auth user with auto-confirmed email...");
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      console.error("Failed to create auth user:", createErr.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`Created auth user (id: ${userId})`);
  }

  // 2. Insert into public.admin_users with role 'owner'
  const { error: dbErr } = await supabase.from("admin_users").upsert(
    {
      user_id: userId,
      email,
      role: "owner",
    },
    { onConflict: "user_id" }
  );

  if (dbErr) {
    console.error("Failed to grant owner role in admin_users:", dbErr.message);
    process.exit(1);
  }

  console.log(`\nSUCCESS! Owner role granted to ${email}.`);
  console.log("------------------------------------------------------------------");
  console.log(`Login URL: ${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/admin/login`);
  console.log(`Email:     ${email}`);
  console.log("Password:  [provided in args or default]");
  console.log("\nNext Steps:");
  console.log("1. Ensure MFA (TOTP) is turned ON in Supabase Dashboard (Auth -> MFA).");
  console.log("2. Navigate to /admin/login and enter credentials.");
  console.log("3. You will be prompted to scan the mandatory TOTP QR code.");
  console.log("4. Once 2FA is verified (AAL2), you will enter the Admin Panel.\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
