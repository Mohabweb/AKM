import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { StaffAccountsManager } from "@/components/admin/StaffAccountsManager";

export const instant = false;

export default async function AdminStaffPage() {
  const admin = await requireAdmin("owner");
  const sb = await sessionClient();

  const { data: users } = await sb
    .from("admin_users")
    .select("user_id, email, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Staff & Access Control
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Owner-only management for authorized administrators. All accounts require two-factor authentication (TOTP).
        </p>
      </div>

      <StaffAccountsManager
        users={users || []}
        currentUserId={admin.id}
      />
    </div>
  );
}
