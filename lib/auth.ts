import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sessionClient } from "@/lib/supabase/server";

export type Admin = { id: string; email: string; role: "owner" | "staff" };

/**
 * Resolves the current admin or null.
 * Requires:
 * 1. Valid Supabase auth user (JWT verified)
 * 2. Mandatory MFA assurance level AAL2
 * 3. Registered row in admin_users
 */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const sb = await sessionClient();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData?.user) return null;

  const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") {
    return null;
  }

  // RLS lets a user read their own admin_users row when is_admin() passes (requiring AAL2)
  const { data: row } = await sb
    .from("admin_users")
    .select("role,email")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!row) return null;
  return { id: userData.user.id, email: row.email, role: row.role };
});

/**
 * Call at the top of EVERY admin page AND EVERY admin server action.
 * Strict gating:
 * - Unauthenticated -> /admin/login
 * - Authenticated at AAL1 with enrolled TOTP -> /admin/mfa-verify
 * - Authenticated at AAL1 without enrolled TOTP -> /admin/mfa-enroll (mandatory)
 * - Authenticated at AAL2 but not in admin_users -> /admin/login?error=not_admin
 * - Staff trying to access owner-only resource -> /admin?denied=1
 */
export async function requireAdmin(minRole: "staff" | "owner" = "staff"): Promise<Admin> {
  const sb = await sessionClient();
  const { data: userData } = await sb.auth.getUser();
  if (!userData?.user) {
    redirect("/admin/login");
  }

  const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData?.currentLevel !== "aal2") {
    const { data: factors } = await sb.auth.mfa.listFactors();
    const hasVerifiedTotp = factors?.totp?.some((f) => f.status === "verified");
    if (hasVerifiedTotp) {
      redirect("/admin/mfa-verify");
    } else {
      redirect("/admin/mfa-enroll");
    }
  }

  const { data: row } = await sb
    .from("admin_users")
    .select("role,email")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!row) {
    redirect("/admin/login?error=not_admin");
  }

  if (minRole === "owner" && row.role !== "owner") {
    redirect("/admin?denied=1");
  }

  return { id: userData.user.id, email: row.email, role: row.role };
}
