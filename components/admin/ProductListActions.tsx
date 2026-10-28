"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setProductStatusAction,
  deleteProductAction,
  duplicateProductAction,
} from "@/app/(admin)/admin/actions";

export function ProductRowActions({
  product,
  isOwner,
}: {
  product: { id: string; name: string; slug: string; status: string };
  isOwner: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (newStatus: "draft" | "published" | "archived") => {
    setLoading(true);
    try {
      await setProductStatusAction(product.id, newStatus);
    } catch (err: any) {
      alert(err?.message || "Failed to change status");
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setLoading(true);
    try {
      await duplicateProductAction(product.id);
    } catch (err: any) {
      alert(err?.message || "Failed to duplicate");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${product.name}"? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await deleteProductAction(product.id);
    } catch (err: any) {
      alert(err?.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {/* Storefront Preview */}
      <Link
        href={`/product/${product.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-[#0E7C89] hover:text-[#0E7C89] text-[11px] font-medium transition-colors"
        title="View on public store"
      >
        Preview ↗
      </Link>

      {/* Edit */}
      <Link
        href={`/admin/products/${product.id}`}
        className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-[11px] font-bold transition-colors"
      >
        Edit
      </Link>

      {/* Publish / Hide */}
      {product.status === "published" ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange("draft")}
          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold transition-colors disabled:opacity-50"
        >
          Hide
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange("published")}
          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold transition-colors disabled:opacity-50"
        >
          Publish
        </button>
      )}

      {/* Duplicate */}
      <button
        type="button"
        disabled={loading}
        onClick={handleDuplicate}
        className="px-2.5 py-1.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-600 text-[11px] font-medium border border-neutral-200 transition-colors disabled:opacity-50"
      >
        Duplicate
      </button>

      {/* Archive / Delete */}
      {product.status !== "archived" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => handleStatusChange("archived")}
          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-red-50 text-neutral-600 hover:text-red-700 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          Archive
        </button>
      )}

      {isOwner && (
        <button
          type="button"
          disabled={loading}
          onClick={handleDelete}
          className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      )}
    </div>
  );
}
