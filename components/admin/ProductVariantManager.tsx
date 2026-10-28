"use client";

import { useState } from "react";
import { saveVariantAction, deleteVariantAction } from "@/app/(admin)/admin/actions";

type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
};

export function ProductVariantManager({
  productId,
  productSlug,
  variants = [],
}: {
  productId: string;
  productSlug: string;
  variants: Variant[];
}) {
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [stock, setStock] = useState("10");
  const [sku, setSku] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSizeChange = (s: string) => {
    setSize(s);
    if (!sku) {
      setSku(`${productSlug.toUpperCase()}-${s}`);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!size) return;

    setLoading(true);
    setError(null);
    try {
      const finalSku = sku || `${productSlug.toUpperCase()}-${size}`;
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("sku", finalSku);
      formData.append("size", size);
      formData.append("color", color);
      formData.append("stock", stock);

      await saveVariantAction(formData);
      setSize("");
      setColor("");
      setSku("");
    } catch (err: any) {
      setError(err?.message || "Failed to add variant.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (variantId: string) => {
    if (!confirm("Delete this size variant?")) return;
    try {
      await deleteVariantAction(variantId, productId);
    } catch (err: any) {
      alert(err?.message || "Failed to delete variant");
    }
  };

  const handleAddStandardSizes = async () => {
    const standardSizes = ["40", "41", "42", "43", "44", "45"];
    const existingSizes = new Set(variants.map((v) => v.size));
    const missing = standardSizes.filter((s) => !existingSizes.has(s));

    if (!missing.length) {
      alert("All standard sizes (40-45) already exist for this product.");
      return;
    }

    setLoading(true);
    try {
      for (const s of missing) {
        const formData = new FormData();
        formData.append("productId", productId);
        formData.append("sku", `${productSlug.toUpperCase()}-${s}`);
        formData.append("size", s);
        formData.append("color", color);
        formData.append("stock", "5");
        await saveVariantAction(formData);
      }
    } catch (err: any) {
      setError(err?.message || "Error adding standard sizes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* Existing Variants Table */}
      {variants.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Color</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-right">In Stock</th>
                <th className="py-2.5 px-3 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {variants.map((v) => (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="py-2.5 px-3 font-bold text-sm text-[#0B1F23]">
                    {v.size}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600">
                    {v.color || "—"}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-neutral-500">
                    {v.sku}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        v.stock === 0
                          ? "bg-red-100 text-red-800"
                          : v.stock <= 3
                          ? "bg-amber-100 text-amber-800"
                          : "text-neutral-800 bg-neutral-100"
                      }`}
                    >
                      {v.stock}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="text-red-600 hover:text-red-800 font-bold text-xs"
                      title="Remove variant"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-500 text-center">
          No size variants added yet. Customers cannot purchase this shoe until at least one size variant is created with stock.
        </div>
      )}

      {/* Quick Add Standard Sizes Button */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={loading}
          onClick={handleAddStandardSizes}
          className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white font-semibold transition-colors disabled:opacity-50"
        >
          + Add Standard Sizes (40, 41, 42, 43, 44, 45)
        </button>
      </div>

      {/* Add Single Variant Form */}
      <form onSubmit={handleAddVariant} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
        <span className="text-xs font-bold text-[#0B1F23] block">
          Add Custom Size Variant
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">
              Size (e.g. 42)
            </label>
            <input
              type="text"
              required
              value={size}
              onChange={(e) => handleSizeChange(e.target.value)}
              placeholder="42"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">
              Color (Optional)
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Black"
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">
              SKU
            </label>
            <input
              type="text"
              required
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="SKU-..."
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">
              Initial Stock
            </label>
            <input
              type="number"
              min={0}
              required
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 text-xs bg-white font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !size}
          className="w-full py-2 rounded-lg bg-[#0E7C89] hover:bg-[#0b646f] text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          {loading ? "Adding..." : "+ Add Variant"}
        </button>
      </form>
    </div>
  );
}
