"use client";

import { useState } from "react";
import {
  updateShippingZoneAction,
  confirmShippingFeesReviewedAction,
} from "@/app/(admin)/admin/actions";

type Zone = {
  id: string;
  governorate: string;
  fee_piasters: number;
  is_active: boolean;
  sort_order: number;
};

export function ShippingFeesEditor({
  zones = [],
  isReviewed,
  isOwner,
}: {
  zones: Zone[];
  isReviewed: boolean;
  isOwner: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feeEgp, setFeeEgp] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(isReviewed);

  const startEdit = (z: Zone) => {
    setEditingId(z.id);
    setFeeEgp((z.fee_piasters / 100).toString());
    setIsActive(z.is_active);
  };

  const handleSave = async (id: string) => {
    setLoading(true);
    try {
      await updateShippingZoneAction(id, parseFloat(feeEgp) || 0, isActive);
      setEditingId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to update shipping fee");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReviewed = async () => {
    setLoading(true);
    try {
      await confirmShippingFeesReviewedAction();
      setReviewed(true);
    } catch (err: any) {
      alert(err?.message || "Failed to confirm review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Review Confirmation Banner */}
      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        reviewed
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}>
        <div>
          <span className="font-bold text-sm block">
            {reviewed
              ? "✓ Shipping Rates Confirmed"
              : "⚠️ Owner Review Required Before Launch"}
          </span>
          <span className="text-xs mt-0.5 block">
            {reviewed
              ? "All governorate shipping rates have been reviewed and approved by the store owner."
              : "Review the courier delivery rates below for Cairo, Alexandria, Giza, and all Egyptian governorates."}
          </span>
        </div>

        {isOwner && !reviewed && (
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirmReviewed}
            className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-xs transition-colors shrink-0 self-start sm:self-auto disabled:opacity-50"
          >
            Mark Rates as Reviewed ✓
          </button>
        )}
      </div>

      {/* Governorate Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200/80 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              <th className="py-3 px-4">Governorate</th>
              <th className="py-3 px-4">Delivery Fee (EGP)</th>
              <th className="py-3 px-4">Status</th>
              {isOwner && <th className="py-3 px-4 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium">
            {zones.map((z) => {
              const isEditing = editingId === z.id;
              return (
                <tr key={z.id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-sm text-[#0B1F23]">
                    {z.governorate}
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 max-w-[140px]">
                        <span className="text-neutral-400 font-bold">EGP</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={feeEgp}
                          onChange={(e) => setFeeEgp(e.target.value)}
                          className="w-full px-2 py-1 rounded-lg border border-neutral-300 text-xs font-bold"
                        />
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-[#0B1F23]">
                        {z.fee_piasters === 0 ? "FREE" : `EGP ${z.fee_piasters / 100}`}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    {isEditing ? (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="rounded text-[#0E7C89]"
                        />
                        <span>Deliverable</span>
                      </label>
                    ) : (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          z.is_active
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {z.is_active ? "Active" : "Disabled"}
                      </span>
                    )}
                  </td>

                  {isOwner && (
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSave(z.id)}
                            className="px-3 py-1 rounded-lg bg-[#0E7C89] text-white font-bold text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(z)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-xs font-semibold transition-colors"
                        >
                          Edit Rate
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
