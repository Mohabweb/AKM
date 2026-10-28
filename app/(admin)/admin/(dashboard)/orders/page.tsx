import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";

export const instant = false;

const PAGE_SIZE = 20;

export default async function AdminOrdersListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    method?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sb = await sessionClient();
  const params = await searchParams;

  const query = params.q?.trim() || "";
  const statusFilter = params.status || "all";
  const methodFilter = params.method || "all";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  // Build query
  let dbQuery = sb
    .from("orders")
    .select(
      "id, order_number, customer_name, phone, governorate, city, total_piasters, status, payment_method, created_at, instapay_receipts(id, status)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    dbQuery = dbQuery.eq("status", statusFilter);
  }

  if (methodFilter && methodFilter !== "all") {
    dbQuery = dbQuery.eq("payment_method", methodFilter);
  }

  if (query) {
    dbQuery = dbQuery.or(
      `order_number.ilike.%${query}%,customer_name.ilike.%${query}%,phone.ilike.%${query}%`
    );
  }

  const { data: orders, count } = await dbQuery.range(offset, offset + PAGE_SIZE - 1);
  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
            Orders
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Manage customer purchases, update fulfillment status, and review receipts.
          </p>
        </div>

        <div className="text-sm text-neutral-500">
          Showing <strong>{orders?.length || 0}</strong> of <strong>{count || 0}</strong> orders
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="lg:col-span-2">
            <label htmlFor="q" className="block text-xs font-semibold text-neutral-600 mb-1">
              Search Orders
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Search by order # (AKM-...), customer, or phone..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          {/* Status filter */}
          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-neutral-600 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="awaiting_verification">Awaiting Verification (InstaPay)</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Payment Method filter */}
          <div>
            <label htmlFor="method" className="block text-xs font-semibold text-neutral-600 mb-1">
              Payment Method
            </label>
            <div className="flex gap-2">
              <select
                id="method"
                name="method"
                defaultValue={methodFilter}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white"
              >
                <option value="all">All Methods</option>
                <option value="cod">Cash on Delivery (COD)</option>
                <option value="instapay">InstaPay</option>
                <option value="card">Credit / Debit Card</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-sm font-semibold transition-colors shrink-0"
              >
                Filter
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Orders Content */}
      {!orders || orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-neutral-500">
          <span className="text-4xl block mb-3">🔍</span>
          <h2 className="text-base font-bold text-[#0B1F23]">No orders found</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            {query || statusFilter !== "all" || methodFilter !== "all"
              ? "Try adjusting your search terms or filters to find what you are looking for."
              : "When customers place orders on your store, they will be listed here."}
          </p>
          {(query || statusFilter !== "all" || methodFilter !== "all") && (
            <Link
              href="/admin/orders"
              className="inline-block mt-4 text-xs font-semibold text-[#0E7C89] hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Governorate</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Total (EGP)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {orders.map((ord: any) => {
                  const hasPendingReceipt = ord.instapay_receipts?.some(
                    (r: any) => r.status === "pending"
                  );
                  return (
                    <tr key={ord.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F23]">
                        <Link
                          href={`/admin/orders/${ord.id}`}
                          className="hover:text-[#0E7C89] hover:underline"
                        >
                          {ord.order_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-500 text-xs whitespace-nowrap">
                        {new Date(ord.created_at).toLocaleDateString("en-EG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#0B1F23]">{ord.customer_name}</div>
                        <div className="text-xs text-neutral-400 font-mono">{ord.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600 text-xs">
                        {ord.governorate}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold uppercase text-neutral-700">
                            {ord.payment_method}
                          </span>
                          {hasPendingReceipt && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Receipt
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            ord.status === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : ord.status === "awaiting_verification"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : ord.status === "shipped" || ord.status === "processing"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : ord.status === "delivered"
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : ord.status === "cancelled"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : ord.status === "refunded"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {ord.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#0B1F23]">
                        {formatEGP(ord.total_piasters)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/admin/orders/${ord.id}`}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-xs font-semibold transition-colors"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (360px friendly) */}
          <div className="md:hidden space-y-3">
            {orders.map((ord: any) => {
              const hasPendingReceipt = ord.instapay_receipts?.some(
                (r: any) => r.status === "pending"
              );
              return (
                <Link
                  key={ord.id}
                  href={`/admin/orders/${ord.id}`}
                  className="block bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs hover:border-[#0E7C89] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-extrabold text-base text-[#0B1F23]">
                      {ord.order_number}
                    </span>
                    <span className="font-mono font-bold text-base text-[#0E7C89]">
                      {formatEGP(ord.total_piasters)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                    <span>{ord.customer_name} ({ord.phone})</span>
                    <span>{ord.governorate}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                        {ord.payment_method}
                      </span>
                      {hasPendingReceipt && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                          Receipt Pending
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        ord.status === "paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : ord.status === "awaiting_verification"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : ord.status === "cancelled"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {ord.status.replace("_", " ")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              {page > 1 && (
                <Link
                  href={`/admin/orders?page=${page - 1}&status=${statusFilter}&method=${methodFilter}&q=${encodeURIComponent(query)}`}
                  className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-semibold hover:bg-neutral-50"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-xs font-medium text-neutral-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/admin/orders?page=${page + 1}&status=${statusFilter}&method=${methodFilter}&q=${encodeURIComponent(query)}`}
                  className="px-4 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-semibold hover:bg-neutral-50"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
