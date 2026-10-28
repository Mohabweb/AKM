import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";

import { PrintButton } from "@/components/admin/PrintButton";

export const instant = false;

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sb = await sessionClient();

  const { data: order, error } = await sb
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .single();

  if (error || !order) notFound();

  return (
    <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton label="Print Invoice" />
      </div>

      <div className="border border-neutral-300 p-8 rounded-2xl print:border-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-neutral-300 pb-6">
          <div>
            <h1 className="font-serif text-3xl font-extrabold tracking-tight text-[#0B1F23]">
              AKM LUXURY SHOES
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-xs">
              484 Horreya Road, opposite Bokla Tram Station, Alexandria, Egypt
            </p>
            <p className="text-xs text-neutral-600">contact@akmshoes.com • 01200756172</p>
          </div>

          <div className="text-right">
            <h2 className="text-2xl font-bold uppercase tracking-wider text-neutral-800">
              INVOICE
            </h2>
            <p className="font-mono text-sm font-bold mt-1 text-[#0B1F23]">
              #{order.order_number}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Date: {new Date(order.created_at).toLocaleDateString("en-EG", { dateStyle: "long" })}
            </p>
          </div>
        </div>

        {/* Bill To & Details */}
        <div className="grid grid-cols-2 gap-8 my-6 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Billed & Shipped To:
            </h3>
            <p className="font-bold text-sm text-neutral-900">{order.customer_name}</p>
            <p className="font-mono text-neutral-700">{order.phone}</p>
            <p className="text-neutral-700 mt-1">{order.address}</p>
            <p className="text-neutral-700">
              {order.area}, {order.city}, {order.governorate}
            </p>
            {order.landmark && (
              <p className="text-neutral-500 italic mt-0.5">Landmark: {order.landmark}</p>
            )}
          </div>

          <div className="text-right">
            <h3 className="font-bold uppercase tracking-wider text-neutral-500 mb-1">
              Order Details:
            </h3>
            <p>
              Payment Method: <strong className="uppercase">{order.payment_method}</strong>
            </p>
            <p>
              Payment Status: <strong className="uppercase">{order.status.replace("_", " ")}</strong>
            </p>
            <p>Currency: <strong>{order.currency}</strong></p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-left border-collapse my-6 text-xs">
          <thead>
            <tr className="border-b-2 border-neutral-300 bg-neutral-50 font-bold uppercase tracking-wider text-neutral-600">
              <th className="py-2.5 px-3">Item Description</th>
              <th className="py-2.5 px-3">SKU</th>
              <th className="py-2.5 px-3">Size</th>
              <th className="py-2.5 px-3 text-center">Qty</th>
              <th className="py-2.5 px-3 text-right">Unit Price</th>
              <th className="py-2.5 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {(order.order_items || []).map((item: any) => (
              <tr key={item.id}>
                <td className="py-3 px-3 font-semibold text-neutral-900">
                  {item.product_name}
                  {item.color && <span className="text-neutral-500 font-normal"> - {item.color}</span>}
                </td>
                <td className="py-3 px-3 font-mono text-neutral-600">{item.sku}</td>
                <td className="py-3 px-3 font-bold">{item.size}</td>
                <td className="py-3 px-3 text-center font-bold">{item.qty}</td>
                <td className="py-3 px-3 text-right font-mono">{formatEGP(item.unit_price_piasters)}</td>
                <td className="py-3 px-3 text-right font-mono font-bold">
                  {formatEGP(item.line_total_piasters)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total Calculations */}
        <div className="flex justify-end pt-4 border-t-2 border-neutral-300">
          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal:</span>
              <span className="font-mono">{formatEGP(order.subtotal_piasters)}</span>
            </div>
            {order.discount_piasters > 0 && (
              <div className="flex justify-between text-neutral-600">
                <span>Discount ({order.coupon_code}):</span>
                <span className="font-mono">-{formatEGP(order.discount_piasters)}</span>
              </div>
            )}
            <div className="flex justify-between text-neutral-600">
              <span>Shipping Fee:</span>
              <span className="font-mono">{formatEGP(order.shipping_piasters)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-neutral-900 pt-2 border-t border-neutral-300">
              <span>Total Amount:</span>
              <span className="font-mono text-[#0E7C89]">{formatEGP(order.total_piasters)}</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-6 border-t border-neutral-200 text-center text-xs text-neutral-500">
          Thank you for choosing AKM Luxury Shoes! For questions, please contact our support team.
        </div>
      </div>
    </div>
  );
}
