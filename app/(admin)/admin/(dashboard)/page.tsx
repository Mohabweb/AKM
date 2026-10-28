import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";

export const instant = false;

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const sb = await sessionClient();

  // 1. Fetch real summary metrics
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    { count: totalOrdersCount },
    { count: todayOrdersCount },
    { count: pendingReceiptsCount },
    { count: processingOrdersCount },
    { count: totalProductsCount },
    { data: recentOrders },
    { data: lowStockVariants },
    { data: shippingReviewedSetting },
  ] = await Promise.all([
    sb.from("orders").select("id", { count: "exact", head: true }),
    sb.from("orders").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    sb.from("instapay_receipts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing"]),
    sb.from("products").select("id", { count: "exact", head: true }).neq("status", "archived"),
    sb.from("orders").select("id, order_number, customer_name, phone, governorate, total_piasters, status, payment_method, created_at").order("created_at", { ascending: false }).limit(6),
    sb.from("product_variants").select("id, sku, size, stock, product_id, products(name)").lte("stock", 3).order("stock", { ascending: true }).limit(5),
    sb.from("settings").select("value").eq("key", "shipping_fees_reviewed").maybeSingle(),
  ]);

  const shippingReviewed = shippingReviewedSetting?.value === "true" || shippingReviewedSetting?.value === true;

  // Real today's revenue from succeeded/paid orders
  const { data: todayPaid } = await sb
    .from("orders")
    .select("total_piasters")
    .gte("created_at", todayStart)
    .in("status", ["paid", "processing", "shipped", "delivered"]);

  const todayRevenuePiasters = (todayPaid ?? []).reduce((acc, row) => acc + (row.total_piasters || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
            Store Overview
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Real-time activity and orders for AKM Luxury Shoes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="px-4 py-2.5 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Product</span>
          </Link>
          <Link
            href="/admin/orders"
            className="px-4 py-2.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-sm font-semibold transition-colors"
          >
            View All Orders
          </Link>
        </div>
      </div>

      {/* Warning Alert if Shipping Fees have not been reviewed */}
      {!shippingReviewed && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">Action Needed: Review Governorate Shipping Fees</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Shipping rates are currently using temporary placeholder fees (EGP 60). Please confirm your official delivery rates before launching.
              </p>
            </div>
          </div>
          <Link
            href="/admin/shipping"
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            Review Shipping Fees →
          </Link>
        </div>
      )}

      {/* Real Metric Cards (No Fake Numbers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Orders */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Orders Today
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F23] mt-2">
            {todayOrdersCount || 0}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            Total all-time: {totalOrdersCount || 0}
          </div>
        </div>

        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Sales Today
          </div>
          <div className="text-3xl font-extrabold text-[#0E7C89] mt-2 font-mono">
            {formatEGP(todayRevenuePiasters)}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            Paid & confirmed orders
          </div>
        </div>

        {/* Pending InstaPay Receipts */}
        <Link
          href="/admin/orders?status=awaiting_verification"
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-amber-300 transition-colors block group"
        >
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-amber-700 flex items-center justify-between">
            <span>Pending Receipts</span>
            {(pendingReceiptsCount || 0) > 0 && (
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            )}
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${(pendingReceiptsCount || 0) > 0 ? "text-amber-600" : "text-[#0B1F23]"}`}>
            {pendingReceiptsCount || 0}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            InstaPay uploads waiting for review →
          </div>
        </Link>

        {/* Processing Orders */}
        <Link
          href="/admin/orders?status=processing"
          className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs hover:border-[#0E7C89] transition-colors block"
        >
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            To Pack & Ship
          </div>
          <div className="text-3xl font-extrabold text-[#0B1F23] mt-2">
            {processingOrdersCount || 0}
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            Paid orders needing delivery →
          </div>
        </Link>
      </div>

      {/* Main Grid: Recent Orders & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0B1F23]">Recent Orders</h2>
              <p className="text-xs text-neutral-500">Latest customer purchases</p>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs font-semibold text-[#0E7C89] hover:underline"
            >
              View all orders →
            </Link>
          </div>

          {!recentOrders || recentOrders.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <span className="text-4xl block mb-2">📦</span>
              <p className="text-sm font-medium">No orders recorded yet.</p>
              <p className="text-xs mt-1">Orders placed on the storefront will appear here automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentOrders.map((ord: any) => (
                <Link
                  key={ord.id}
                  href={`/admin/orders/${ord.id}`}
                  className="p-4 flex items-center justify-between hover:bg-neutral-50/80 transition-colors block"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#0B1F23]">
                        {ord.order_number}
                      </span>
                      <span className="text-xs text-neutral-400">
                        • {new Date(ord.created_at).toLocaleDateString("en-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 truncate mt-0.5">
                      {ord.customer_name} ({ord.phone}) — {ord.governorate}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#0B1F23] font-mono">
                      {formatEGP(ord.total_piasters)}
                    </div>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-0.5 ${
                      ord.status === "paid"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : ord.status === "awaiting_verification"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : ord.status === "delivered"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : ord.status === "cancelled"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-neutral-100 text-neutral-700"
                    }`}>
                      {ord.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock & Catalog Summary (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23]">Low Stock Alerts</h2>
            <p className="text-xs text-neutral-500 mb-4">Variants with 3 or fewer pairs remaining</p>

            {!lowStockVariants || lowStockVariants.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400">
                <span className="text-2xl block mb-1">✅</span>
                No low stock alerts at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockVariants.map((v: any) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-neutral-50 border border-neutral-100"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-[#0B1F23] truncate">
                        {(v.products as any)?.name || "Shoe Variant"}
                      </p>
                      <p className="text-neutral-500 font-mono text-[11px]">
                        Size: {v.size} • SKU: {v.sku}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-md font-bold text-xs ${
                      v.stock === 0
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {v.stock === 0 ? "Out of Stock" : `${v.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23]">Store Shortcuts</h2>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Link
                href="/admin/products"
                className="p-3 rounded-xl bg-neutral-50 hover:bg-[#0E7C89]/10 text-xs font-semibold text-neutral-800 hover:text-[#0E7C89] transition-colors border border-neutral-100 text-center"
              >
                Products ({totalProductsCount || 0})
              </Link>
              <Link
                href="/admin/categories"
                className="p-3 rounded-xl bg-neutral-50 hover:bg-[#0E7C89]/10 text-xs font-semibold text-neutral-800 hover:text-[#0E7C89] transition-colors border border-neutral-100 text-center"
              >
                Categories
              </Link>
              <Link
                href="/admin/homepage"
                className="p-3 rounded-xl bg-neutral-50 hover:bg-[#0E7C89]/10 text-xs font-semibold text-neutral-800 hover:text-[#0E7C89] transition-colors border border-neutral-100 text-center"
              >
                Homepage Editor
              </Link>
              <Link
                href="/admin/settings"
                className="p-3 rounded-xl bg-neutral-50 hover:bg-[#0E7C89]/10 text-xs font-semibold text-neutral-800 hover:text-[#0E7C89] transition-colors border border-neutral-100 text-center"
              >
                Settings & InstaPay
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
