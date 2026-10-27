import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sessionClient } from "@/lib/supabase/server";

export type Admin = { id: string; email: string; role: "owner" | "staff" };

/** Resolves the current admin or null. Uses getUser() (verifies the JWT with Supabase), never getSession(). */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const sb = await sessionClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  // RLS lets a user read only their own admin_users row (owners read all)
  const { data: row } = await sb.from("admin_users").select("role,email").eq("user_id", data.user.id).maybeSingle();
  if (!row) return null;
  return { id: data.user.id, email: row.email, role: row.role };
});

/** Call at the top of every admin page AND every admin server action. The proxy is a convenience, not the gate. */
export async function requireAdmin(minRole: "staff" | "owner" = "staff"): Promise<Admin> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (minRole === "owner" && a.role !== "owner") redirect("/admin?denied=1");
  return a;
}
