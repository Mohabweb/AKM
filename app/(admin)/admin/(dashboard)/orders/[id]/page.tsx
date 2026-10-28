import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";
import {
  OrderStatusForm,
  OrderInternalNotesForm,
  ReceiptReviewCard,
} from "@/components/admin/OrderDetailForms";

export const instant = false;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sb = await sessionClient();

  // Fetch complete order with items, payments, receipts, and event timeline
  const { data: order, error } = await sb
    .from("orders")
    .select(`
      *,
      order_items(*),
      payments(*),
      instapay_receipts(*),
      order_events(*)
    `)
    .eq("id", id)
    .single();

  if (error || !order) {
    notFound();
  }

  // Generate signed URLs for private receipts
  const receiptsWithUrls = await Promise.all(
    (order.instapay_receipts || []).map(async (r: any) => {
      let signedUrl: string | null = null;
      if (r.storage_path) {
        const { data: signData } = await sb.storage
          .from("instapay-receipts")
          .createSignedUrl(r.storage_path, 3600); // 1 hour validity
        signedUrl = signData?.signedUrl || null;
      }
      return { ...r, signedUrl };
    })
  );

  // WhatsApp link — Egyptian phone format 01XXXXXXXXX -> 201XXXXXXXXX
  const hasPhone = Boolean(order.phone && order.phone.trim().length >= 10);
  const normalizedWaPhone = order.phone
    ? `20${order.phone.trim().replace(/^0+/, "")}`
    : "";
  const waMessage = encodeURIComponent(
    `Hello ${order.customer_name}, regarding your order ${order.order_number} from AKM Luxury Shoes:`
  );
  const waUrl = `https://wa.me/${normalizedWaPhone}?text=${waMessage}`;

  const isOwner = admin.role === "owner";

  return (
    <div className="space-y-6">
      {/* Back link & Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-2 rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight font-mono text-[#0B1F23]">
                {order.order_number}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  order.status === "paid"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : order.status === "awaiting_verification"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : order.status === "shipped" || order.status === "processing"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : order.status === "delivered"
                    ? "bg-teal-50 text-teal-800 border border-teal-200"
                    : order.status === "cancelled"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {order.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Placed on {new Date(order.created_at).toLocaleString("en-EG", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        </div>

        {/* Action Buttons: Print Invoice & Packing Slip */}
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/orders/${order.id}/print/invoice`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print Invoice</span>
          </Link>

          <Link
            href={`/admin/orders/${order.id}/print/packing-slip`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Packing Slip</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Items & Delivery Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Purchased Items Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1F23]">Items Ordered</h2>
              <span className="text-xs text-neutral-500 font-medium">
                {order.order_items?.length || 0} item{(order.order_items?.length || 0) === 1 ? "" : "s"}
              </span>
            </div>

            <div className="divide-y divide-neutral-100">
              {(order.order_items || []).map((item: any) => (
                <div key={item.id} className="p-4 sm:p-5 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 border border-neutral-200 shrink-0 overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl text-neutral-300">👞</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[#0B1F23] truncate">
                      {item.product_name}
                    </p>
                    <div className="text-xs text-neutral-500 mt-0.5 space-x-2 font-mono">
                      <span>Size: <strong>{item.size}</strong></span>
                      {item.color && <span>• Color: {item.color}</span>}
                      <span>• SKU: {item.sku}</span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {formatEGP(item.unit_price_piasters)} × {item.qty} pair{item.qty > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div className="text-right font-mono font-bold text-sm text-[#0B1F23]">
                    {formatEGP(item.line_total_piasters)}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="bg-neutral-50/70 p-5 border-t border-neutral-200/80 space-y-2 text-sm">
              <div className="flex justify-between text-neutral-600 text-xs">
                <span>Subtotal</span>
                <span className="font-mono">{formatEGP(order.subtotal_piasters)}</span>
              </div>
              {order.discount_piasters > 0 && (
                <div className="flex justify-between text-emerald-700 text-xs font-medium">
                  <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                  <span className="font-mono">-{formatEGP(order.discount_piasters)}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600 text-xs">
                <span>Shipping ({order.governorate})</span>
                <span className="font-mono">{formatEGP(order.shipping_piasters)}</span>
              </div>
              <div className="flex justify-between text-[#0B1F23] font-bold text-base pt-2 border-t border-neutral-200">
                <span>Grand Total</span>
                <span className="font-mono text-[#0E7C89]">{formatEGP(order.total_piasters)}</span>
              </div>
            </div>
          </div>

          {/* Customer & Delivery Address Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
            <h2 className="text-base font-bold text-[#0B1F23]">Customer & Delivery Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                  Recipient
                </span>
                <p className="font-semibold text-sm text-[#0B1F23]">{order.customer_name}</p>
                <p className="font-mono text-neutral-700 mt-0.5">{order.phone}</p>

                {/* WhatsApp button - only if phone is set */}
                {hasPhone && (
                  <div className="mt-3">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      <span>💬 Chat on WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              <div>
                <span className="font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                  Shipping Destination
                </span>
                <p className="text-neutral-800 font-medium">
                  {order.address}
                </p>
                <p className="text-neutral-600 mt-0.5">
                  Area: {order.area}, City: {order.city}
                </p>
                <p className="text-neutral-600">
                  Governorate: <strong>{order.governorate}</strong>
                </p>
                {order.landmark && (
                  <p className="text-neutral-500 italic mt-1">
                    Landmark: {order.landmark}
                  </p>
                )}
              </div>
            </div>

            {order.notes && (
              <div className="pt-3 border-t border-neutral-100">
                <span className="font-bold text-neutral-500 uppercase tracking-wider block text-xs mb-1">
                  Customer Checkout Note
                </span>
                <p className="text-xs text-neutral-700 italic bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                  &ldquo;{order.notes}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Order Event Timeline */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23] mb-4">Order History & Audit Trail</h2>

            {!order.order_events || order.order_events.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">No event logs recorded for this order.</p>
            ) : (
              <div className="relative pl-6 space-y-4 border-l-2 border-neutral-200">
                {order.order_events.map((ev: any) => (
                  <div key={ev.id} className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#0E7C89] border-2 border-white shadow-xs" />
                    <div className="text-xs">
                      <span className="font-bold text-[#0B1F23] uppercase">
                        {ev.to_status?.replace("_", " ")}
                      </span>
                      {ev.from_status && (
                        <span className="text-neutral-400"> (from {ev.from_status.replace("_", " ")})</span>
                      )}
                      <span className="text-neutral-400 block sm:inline sm:ml-2">
                        {new Date(ev.created_at).toLocaleString("en-EG", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      {ev.note && (
                        <p className="text-neutral-600 mt-1 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                          {ev.note}
                        </p>
                      )}
                      <span className="text-[10px] text-neutral-400 uppercase font-mono mt-0.5 block">
                        Triggered by: {ev.actor_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Management Sidebar */}
        <div className="space-y-6">
          {/* Status Change Workflow Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23] mb-3">Order Status</h2>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
              isOwner={isOwner}
            />
          </div>

          {/* Internal Notes Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23] mb-1">Internal Notes</h2>
            <p className="text-xs text-neutral-500 mb-3">Visible only to admin staff</p>
            <OrderInternalNotesForm
              orderId={order.id}
              initialNotes={order.internal_notes}
            />
          </div>

          {/* InstaPay Receipt Review (if instapay) */}
          {order.payment_method === "instapay" && (
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[#0B1F23]">InstaPay Receipt Review</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Verify customer payment transfer proof
                </p>
              </div>

              {receiptsWithUrls.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <p className="font-semibold mb-0.5">No receipt uploaded yet</p>
                  <p>Customer has not attached an InstaPay transfer screenshot.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receiptsWithUrls.map((r: any) => (
                    <ReceiptReviewCard
                      key={r.id}
                      receipt={r}
                      orderId={order.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Details Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-5">
            <h2 className="text-base font-bold text-[#0B1F23] mb-2">Payment Info</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Method</span>
                <span className="font-bold uppercase text-[#0B1F23]">{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Currency</span>
                <span className="font-mono text-neutral-800">{order.currency}</span>
              </div>
              {order.payments?.length > 0 && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="text-neutral-500 block mb-1">Provider Records:</span>
                  {order.payments.map((p: any) => (
                    <div key={p.id} className="p-2 rounded-lg bg-neutral-50 border border-neutral-100 space-y-0.5 font-mono text-[11px]">
                      <div>Status: <strong>{p.status}</strong></div>
                      <div>Provider: {p.provider}</div>
                      {p.provider_ref && <div>Ref: {p.provider_ref}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
