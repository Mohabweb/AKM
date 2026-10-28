"use client";

import { useState } from "react";
import { saveBrandAction, deleteBrandAction } from "@/app/(admin)/admin/actions";
import { slugify } from "@/lib/validation";

type Brand = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  sort_order: number;
};

export function BrandManager({
  brands = [],
  isOwner,
}: {
  brands: Brand[];
  isOwner: boolean;
}) {
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const startEdit = (b: Brand) => {
    setEditingBrand(b);
    setName(b.name);
    setSlug(b.slug);
    setLogoUrl(b.logo_url || "");
    setSortOrder(b.sort_order.toString());
    setIsActive(b.is_active);
  };

  const cancelEdit = () => {
    setEditingBrand(null);
    setName("");
    setSlug("");
    setLogoUrl("");
    setSortOrder("0");
    setIsActive(true);
  };

  const handleDelete = async (id: string, brandName: string) => {
    if (!confirm(`Delete brand "${brandName}"?`)) return;
    try {
      await deleteBrandAction(id);
    } catch (err: any) {
      alert(err?.message || "Failed to delete brand");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Brands List (2 Cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1F23]">Existing Brands</h2>
          <span className="text-xs text-neutral-400">{brands.length} brands</span>
        </div>

        {!brands.length ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            No brands found. Create your first brand using the form.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {brands.map((b) => (
              <div key={b.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0B1F23]">{b.name}</span>
                    <span className="text-xs font-mono text-neutral-400">/{b.slug}</span>
                    {b.is_demo && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-200 text-neutral-600 font-bold uppercase">
                        demo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Order: {b.sort_order} • Status: {b.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(b)}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-xs font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id, b.name)}
                      className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Brand Form (1 Col) */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0B1F23]">
          {editingBrand ? `Edit Brand: ${editingBrand.name}` : "Add New Brand"}
        </h2>

        <form action={saveBrandAction} className="space-y-3">
          {editingBrand && <input type="hidden" name="id" value={editingBrand.id} />}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Brand Name *
            </label>
            <input
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingBrand) setSlug(slugify(e.target.value));
              }}
              placeholder="e.g. Oxford Heritage"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Slug *
            </label>
            <input
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="oxford-heritage"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Logo Image URL (Optional)
            </label>
            <input
              name="logoUrl"
              type="text"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Display Order
              </label>
              <input
                name="sortOrder"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-[#0E7C89]"
                />
                <span>Active</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-xs font-bold transition-colors"
            >
              {editingBrand ? "Save Brand" : "Create Brand"}
            </button>
            {editingBrand && (
              <button
                type="button"
                onClick={cancelEdit}
                className="py-2.5 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
