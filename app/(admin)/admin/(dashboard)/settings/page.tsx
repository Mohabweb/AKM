import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const instant = false;

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const { data: rows } = await sb.from("settings").select("key, value");

  const settingsMap: Record<string, string> = {};
  (rows || []).forEach((r) => {
    let val = r.value;
    if (typeof val === "string") {
      val = val.replace(/^"|"$/g, "");
    }
    settingsMap[r.key] = String(val ?? "");
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Store Settings
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Manage contact information, InstaPay transfers, WhatsApp business connection, and customer policies.
        </p>
      </div>

      <SettingsForm
        settings={settingsMap}
        isOwner={admin.role === "owner"}
      />
    </div>
  );
}
