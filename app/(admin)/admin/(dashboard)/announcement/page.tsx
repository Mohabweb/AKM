import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { updateAnnouncementAction } from "@/app/(admin)/admin/actions";

export const instant = false;

export default async function AdminAnnouncementPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const { data: settings } = await sb
    .from("settings")
    .select("key, value")
    .in("key", ["announcement_enabled", "announcement_text", "announcement_href"]);

  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));

  const isEnabled = map.announcement_enabled === true || map.announcement_enabled === "true";
  const text = typeof map.announcement_text === "string" ? map.announcement_text.replace(/^"|"$/g, "") : "";
  const href = typeof map.announcement_href === "string" ? map.announcement_href.replace(/^"|"$/g, "") : "";

  const isOwner = admin.role === "owner";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Announcement Bar
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Top banner displayed across all store pages for promotions, shipping updates, or alerts.
        </p>
      </div>

      {!isOwner ? (
        <div className="p-4 rounded-xl bg-neutral-100 text-neutral-600 text-xs">
          Only the store owner can edit the announcement bar settings.
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs">
          <form action={updateAnnouncementAction} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
              <input
                id="enabled"
                name="enabled"
                type="checkbox"
                defaultChecked={isEnabled}
                className="w-4 h-4 rounded text-[#0E7C89] focus:ring-[#0E7C89]"
              />
              <label htmlFor="enabled" className="text-xs font-bold text-[#0B1F23] cursor-pointer">
                Enable Announcement Bar on Storefront
              </label>
            </div>

            <div>
              <label htmlFor="text" className="block text-xs font-semibold text-neutral-700 mb-1">
                Announcement Message Text *
              </label>
              <input
                id="text"
                name="text"
                type="text"
                defaultValue={text}
                placeholder="e.g. Complimentary shipping on all Alexandria orders this week!"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <label htmlFor="href" className="block text-xs font-semibold text-neutral-700 mb-1">
                Click Destination Link (Optional)
              </label>
              <input
                id="href"
                name="href"
                type="text"
                defaultValue={href}
                placeholder="/shop or https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-xs font-bold shadow-xs transition-colors"
            >
              Save Announcement Settings
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
