import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/ProductForm";

export const instant = false;

export default async function AdminNewProductPage() {
  await requireAdmin();
  const sb = await sessionClient();

  const [{ data: brands }, { data: categories }] = await Promise.all([
    sb.from("brands").select("id, name").order("name"),
    sb.from("categories").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1F23]">
            Add New Product
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add a new shoe style to your catalog. You will be able to upload images and configure size variants next.
          </p>
        </div>
      </div>

      <ProductForm brands={brands || []} categories={categories || []} />
    </div>
  );
}
