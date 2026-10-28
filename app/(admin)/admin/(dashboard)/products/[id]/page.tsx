import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductImageManager } from "@/components/admin/ProductImageManager";
import { ProductVariantManager } from "@/components/admin/ProductVariantManager";

export const instant = false;

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sb = await sessionClient();

  const [
    { data: product, error },
    { data: brands },
    { data: categories },
  ] = await Promise.all([
    sb
      .from("products")
      .select(`
        *,
        product_images(*),
        product_variants(*),
        product_categories(*)
      `)
      .eq("id", id)
      .single(),
    sb.from("brands").select("id, name").order("name"),
    sb.from("categories").select("id, name").order("name"),
  ]);

  if (error || !product) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#0B1F23]">
                {product.name}
              </h1>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  product.status === "published"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : product.status === "draft"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {product.status}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              /{product.slug}
            </p>
          </div>
        </div>

        <Link
          href={`/product/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-white border border-neutral-300 hover:border-[#0E7C89] text-neutral-800 hover:text-[#0E7C89] text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>View on Storefront ↗</span>
        </Link>
      </div>

      {/* Product Details Form */}
      <ProductForm
        initialProduct={product}
        brands={brands || []}
        categories={categories || []}
      />

      {/* Multi-Image Upload & WebP Compression Card */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#0B1F23]">Product Photography & Images</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Upload multiple photos. Images are automatically compressed to WebP and verified by magic bytes. Drag to reorder.
          </p>
        </div>

        <ProductImageManager
          productId={product.id}
          initialImages={product.product_images || []}
        />
      </div>

      {/* Variants, Sizes & Inventory Stock */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#0B1F23]">Size Variants & Stock Inventory</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage sizes, colorways, SKUs, and live inventory.
          </p>
        </div>

        <ProductVariantManager
          productId={product.id}
          productSlug={product.slug}
          variants={product.product_variants || []}
        />
      </div>
    </div>
  );
}
