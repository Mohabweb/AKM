import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/money";

import { PrintButton } from "@/components/admin/PrintButton";

export const instant = false;

export default async function PrintPackingSlipPage({
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

  const isCod = order.payment_method === "cod";

  return (
    <div className="bg-white min-h-screen text-black p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Print Trigger Button (Hidden in Print) */}
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton label="Print Packing Slip" />
      </div>

      <div className="border border-neutral-300 p-8 rounded-2xl print:border-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-neutral-800 pb-4">
          <div>
            <h1 className="font-serif text-2xl font-black text-black tracking-tight">
              AKM LUXURY SHOES
            </h1>
            <p className="text-xs uppercase font-bold text-neutral-500 tracking-wider mt-0.5">
              Warehouse Fulfillment Slip
            </p>
          </div>

          <div className="text-right font-mono">
            <h2 className="text-xl font-black uppercase text-black">
              PACKING SLIP
            </h2>
            <p className="text-base font-extrabold text-[#0E7C89] mt-0.5">
              {order.order_number}
            </p>
            <p className="text-xs text-neutral-500">
              {new Date(order.created_at).toLocaleDateString("en-EG", { dateStyle: "short" })}
            </p>
          </div>
        </div>

        {/* Courier / Collection Box */}
        {isCod ? (
          <div className="my-6 p-4 rounded-xl border-2 border-black bg-neutral-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider block text-neutral-600">
                Courier Payment Notice:
              </span>
              <span className="text-base font-extrabold text-black">
                CASH ON DELIVERY (COD)
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-neutral-600 block">
                Cash to Collect from Customer:
              </span>
              <span className="font-mono text-2xl font-black text-black">
                {formatEGP(order.total_piasters)}
              </span>
            </div>
          </div>
        ) : (
          <div className="my-4 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold flex items-center justify-between">
            <span>PREPAID ORDER ({order.payment_method.toUpperCase()})</span>
            <span>DO NOT COLLECT PAYMENT FROM CUSTOMER</span>
          </div>
        )}

        {/* Recipient & Shipping Destination */}
        <div className="my-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs space-y-1">
          <span className="font-bold uppercase tracking-wider text-neutral-500 block mb-1">
            Deliver To:
          </span>
          <p className="font-bold text-sm text-black">{order.customer_name}</p>
          <p className="font-mono text-black font-semibold text-sm">📞 {order.phone}</p>
          <p className="text-neutral-800 text-xs mt-1">
            {order.address}, {order.area}, {order.city}, <strong>{order.governorate}</strong>
          </p>
          {order.landmark && (
            <p className="text-neutral-600 italic">
              <strong>Landmark:</strong> {order.landmark}
            </p>
          )}
          {order.notes && (
            <p className="text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
              <strong>Customer Instructions:</strong> {order.notes}
            </p>
          )}
        </div>

        {/* Checklist of Items to Pack */}
        <div className="my-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
            Items to Pack (Tick to Verify):
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-neutral-800 bg-neutral-100 font-bold uppercase text-neutral-700">
                <th className="py-2.5 px-3 text-center w-12">Packed</th>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3 font-mono">SKU</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Color</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {(order.order_items || []).map((item: any) => (
                <tr key={item.id} className="h-12">
                  <td className="py-2 px-3 text-center">
                    <div className="w-5 h-5 mx-auto border-2 border-neutral-800 rounded flex items-center justify-center font-bold text-xs" />
                  </td>
                  <td className="py-2 px-3 font-semibold text-black">
                    {item.product_name}
                  </td>
                  <td className="py-2 px-3 font-mono text-neutral-600">{item.sku}</td>
                  <td className="py-2 px-3 font-extrabold text-sm text-black">{item.size}</td>
                  <td className="py-2 px-3 text-neutral-600">{item.color || "—"}</td>
                  <td className="py-2 px-3 text-center font-extrabold text-sm text-black">
                    {item.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sign-off footer */}
        <div className="mt-12 pt-6 border-t border-neutral-300 grid grid-cols-2 gap-8 text-xs text-neutral-600">
          <div>
            <p>Packed by: _______________________</p>
            <p className="mt-2">Date: _______________</p>
          </div>
          <div className="text-right">
            <p>Courier Handover: _______________________</p>
            <p className="mt-2">Tracking / Consignment #: _______________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
