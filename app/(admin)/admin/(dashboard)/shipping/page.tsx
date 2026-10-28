import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { ShippingFeesEditor } from "@/components/admin/ShippingFeesEditor";

export const instant = false;

export default async function AdminShippingPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const [{ data: zones }, { data: reviewSetting }] = await Promise.all([
    sb.from("shipping_zones").select("*").order("sort_order"),
    sb.from("settings").select("value").eq("key", "shipping_fees_reviewed").maybeSingle(),
  ]);

  const isReviewed = reviewSetting?.value === "true" || reviewSetting?.value === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Governorate Shipping Rates
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Configure courier delivery fees across all 27 Egyptian governorates.
        </p>
      </div>

      <ShippingFeesEditor
        zones={zones || []}
        isReviewed={isReviewed}
        isOwner={admin.role === "owner"}
      />
    </div>
  );
}
