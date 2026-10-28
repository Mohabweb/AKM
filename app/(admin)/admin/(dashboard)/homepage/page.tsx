import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { HomepageSectionEditor } from "@/components/admin/HomepageSectionEditor";

export const instant = false;

export default async function AdminHomepagePage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  const [{ data: sections }, { data: categories }] = await Promise.all([
    sb.from("homepage_sections").select("*").order("sort_order"),
    sb.from("categories").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Homepage Sections
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Curate and order the dynamic visual blocks, product rows, and banners on your storefront.
        </p>
      </div>

      <HomepageSectionEditor
        sections={sections || []}
        categories={categories || []}
        isOwner={admin.role === "owner"}
      />
    </div>
  );
}
