import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";
import { ProductRowActions } from "@/components/admin/ProductListActions";

export const instant = false;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const admin = await requireAdmin();
  const sb = await sessionClient();
  const params = await searchParams;

  const query = params.q?.trim() || "";
  const statusFilter = params.status || "all";

  let dbQuery = sb
    .from("products")
    .select(`
      id, name, slug, price_piasters, compare_at_piasters, status, is_featured, is_new_arrival, is_demo, sold_count, created_at,
      brands(name),
      product_images(url, sort_order),
      product_variants(stock)
    `)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    dbQuery = dbQuery.eq("status", statusFilter);
  }

  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data: products } = await dbQuery;

  const isOwner = admin.role === "owner";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
            Products
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Manage your shoe catalog, variants, inventory, and pricing.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="px-4 py-2.5 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Search products by title or slug..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div className="flex gap-2">
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white font-medium"
            >
              <option value="all">All Products</option>
              <option value="published">Published</option>
              <option value="draft">Drafts (Hidden)</option>
              <option value="archived">Archived</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-sm font-semibold transition-colors shrink-0"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Products Content */}
      {!products || products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-neutral-500">
          <span className="text-4xl block mb-3">👞</span>
          <h2 className="text-base font-bold text-[#0B1F23]">No products found</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {query || statusFilter !== "all"
              ? "Try adjusting your search query or filter."
              : "Get started by adding your first shoe style to the catalog."}
          </p>
          <div className="mt-4">
            <Link
              href="/admin/products/new"
              className="inline-block px-4 py-2 rounded-xl bg-[#0E7C89] text-white text-xs font-bold shadow-xs hover:bg-[#0b646f]"
            >
              Create Product
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Price (EGP)</th>
                <th className="py-3 px-4">Total Stock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-sm">
              {products.map((p: any) => {
                const primaryImage = (p.product_images || []).sort(
                  (a: any, b: any) => a.sort_order - b.sort_order
                )[0]?.url;

                const totalStock = (p.product_variants || []).reduce(
                  (acc: number, v: any) => acc + (v.stock || 0),
                  0
                );

                return (
                  <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center">
                          {primaryImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={primaryImage}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl text-neutral-300">👞</span>
                          )}
                        </div>

                        <div className="min-w-0 max-w-xs">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="font-bold text-[#0B1F23] hover:text-[#0E7C89] hover:underline block truncate"
                          >
                            {p.name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                            <span>/{p.slug}</span>
                            {p.is_demo && (
                              <span className="px-1.5 py-0.2 bg-neutral-200 text-neutral-600 rounded text-[9px] font-bold uppercase">
                                demo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-neutral-600">
                      {(p.brands as any)?.name || "—"}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F23]">
                      <div>{formatEGP(p.price_piasters)}</div>
                      {p.compare_at_piasters && (
                        <div className="text-[11px] text-neutral-400 line-through">
                          {formatEGP(p.compare_at_piasters)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded-md font-bold ${
                          totalStock === 0
                            ? "bg-red-100 text-red-800"
                            : totalStock <= 3
                            ? "bg-amber-100 text-amber-800"
                            : "text-neutral-700 bg-neutral-100"
                        }`}
                      >
                        {totalStock} in stock
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          p.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "draft"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <ProductRowActions product={p} isOwner={isOwner} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
