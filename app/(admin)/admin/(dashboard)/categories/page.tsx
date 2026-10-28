import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/admin/CategoryList";

export const instant = false;

export default async function AdminCategoriesPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const { data: categories } = await sb
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Categories
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Organize your shoes into storefront categories, trending groups, and seasonal collections.
        </p>
      </div>

      <CategoryManager categories={categories || []} isOwner={admin.role === "owner"} />
    </div>
  );
}
