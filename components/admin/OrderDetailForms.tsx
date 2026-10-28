"use client";

import { useState } from "react";
import {
  setOrderStatusAction,
  setOrderInternalNotesAction,
  reviewReceiptAction,
} from "@/app/(admin)/admin/actions";

export function OrderStatusForm({
  orderId,
  currentStatus,
  isOwner,
}: {
  orderId: string;
  currentStatus: string;
  isOwner: boolean;
}) {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allowed transitions per db/_apply_status
  const allowedMap: Record<string, string[]> = {
    pending_payment: ["awaiting_verification", "paid", "cancelled"],
    awaiting_verification: ["paid", "pending_payment", "cancelled"],
    paid: ["processing", "cancelled", ...(isOwner ? ["refunded"] : [])],
    processing: ["shipped", "cancelled", ...(isOwner ? ["refunded"] : [])],
    shipped: ["delivered", "cancelled", ...(isOwner ? ["refunded"] : [])],
    delivered: [...(isOwner ? ["refunded"] : [])],
  };

  const allowed = allowedMap[currentStatus] || [];

  if (allowed.length === 0) {
    return (
      <div className="text-xs text-neutral-400 italic">
        This order is in a final state ({currentStatus.replace("_", " ")}). No further status transitions are available.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;

    if (selectedStatus === "cancelled" || selectedStatus === "refunded") {
      if (!confirm(`Are you sure you want to mark this order as ${selectedStatus.toUpperCase()}? This will update stock and financial records.`)) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await setOrderStatusAction(orderId, selectedStatus, note);
      setSelectedStatus("");
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-neutral-600 mb-1">
          Update Order Status
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white font-medium"
        >
          <option value="">Select next status...</option>
          {allowed.map((st) => (
            <option key={st} value={st}>
              Move to: {st.replace("_", " ").toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-600 mb-1">
          Status Change Note (Optional)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Courier tracking #, payment confirmation ref..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !selectedStatus}
        className="w-full py-2.5 px-4 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {loading ? "Updating Status..." : "Apply Status Change"}
      </button>
    </form>
  );
}

export function OrderInternalNotesForm({
  orderId,
  initialNotes,
}: {
  orderId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      await setOrderInternalNotesAction(orderId, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs">
          {error}
        </div>
      )}

      <div>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private internal notes only visible to staff & owner (e.g. customer requested evening delivery, verified via WhatsApp)..."
          className="w-full p-3 rounded-xl border border-neutral-300 text-xs text-[#0B1F23] focus:outline-none focus:ring-2 focus:ring-[#0E7C89] placeholder:text-neutral-400"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-emerald-600 font-semibold">
          {saved && "✓ Note saved successfully"}
        </span>
        <button
          type="submit"
          disabled={loading}
          className="py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Internal Note"}
        </button>
      </div>
    </form>
  );
}

export function ReceiptReviewCard({
  receipt,
  orderId,
}: {
  receipt: {
    id: string;
    storage_path: string;
    status: string;
    note: string | null;
    signedUrl: string | null;
    uploaded_at: string;
  };
  orderId: string;
}) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async (approve: boolean) => {
    const action = approve ? "APPROVE" : "REJECT";
    if (!confirm(`Are you sure you want to ${action} this InstaPay receipt?`)) return;

    setLoading(true);
    setError(null);
    try {
      await reviewReceiptAction(receipt.id, orderId, approve, note);
    } catch (err: any) {
      setError(err?.message || `Failed to review receipt`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-neutral-200 bg-neutral-50/60 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-700 uppercase">
          InstaPay Transfer Proof
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            receipt.status === "approved"
              ? "bg-emerald-100 text-emerald-800"
              : receipt.status === "rejected"
              ? "bg-red-100 text-red-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {receipt.status}
        </span>
      </div>

      {receipt.signedUrl ? (
        <div className="bg-white p-2 rounded-xl border border-neutral-200 flex flex-col items-center">
          <a
            href={receipt.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg group relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receipt.signedUrl}
              alt="InstaPay Receipt"
              className="max-h-72 w-auto object-contain rounded-lg group-hover:scale-102 transition-transform"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
              Click to View Full Size ↗
            </div>
          </a>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-neutral-200 text-neutral-500 text-xs text-center">
          Receipt file not accessible.
        </div>
      )}

      {receipt.note && (
        <p className="text-xs text-neutral-600 bg-white p-2.5 rounded-lg border border-neutral-200">
          <strong>Reviewer Note:</strong> {receipt.note}
        </p>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 text-red-800 text-xs">
          {error}
        </div>
      )}

      {receipt.status === "pending" && (
        <div className="space-y-2 pt-2 border-t border-neutral-200">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional review note (e.g. transfer verified on 01200756172)..."
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview(true)}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              ✓ Approve Receipt (Mark Paid)
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview(false)}
              className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              ✕ Reject Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
