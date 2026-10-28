import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { BrandManager } from "@/components/admin/BrandList";

export const instant = false;

export default async function AdminBrandsPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const { data: brands } = await sb
    .from("brands")
    .select("*")
    .order("sort_order")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Brands
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Manage shoe manufacturers and brand collections.
        </p>
      </div>

      <BrandManager brands={brands || []} isOwner={admin.role === "owner"} />
    </div>
  );
}
