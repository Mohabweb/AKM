"use client";

import { useState } from "react";
import { saveCategoryAction, deleteCategoryAction } from "@/app/(admin)/admin/actions";
import { slugify } from "@/lib/validation";

type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  kind: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  is_demo: boolean;
  sort_order: number;
};

export function CategoryManager({
  categories = [],
  isOwner,
}: {
  categories: Category[];
  isOwner: boolean;
}) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState("category");
  const [parentId, setParentId] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const startEdit = (c: Category) => {
    setEditingCategory(c);
    setName(c.name);
    setSlug(c.slug);
    setKind(c.kind);
    setParentId(c.parent_id || "");
    setDescription(c.description || "");
    setImageUrl(c.image_url || "");
    setSortOrder(c.sort_order.toString());
    setIsActive(c.is_active);
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setKind("category");
    setParentId("");
    setDescription("");
    setImageUrl("");
    setSortOrder("0");
    setIsActive(true);
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Delete category "${catName}"?`)) return;
    try {
      await deleteCategoryAction(id);
    } catch (err: any) {
      alert(err?.message || "Failed to delete category");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Categories List (2 Cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1F23]">Existing Store Categories</h2>
          <span className="text-xs text-neutral-400">{categories.length} categories</span>
        </div>

        {!categories.length ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            No categories found. Add your first category using the form.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {categories.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0B1F23]">{c.name}</span>
                    <span className="text-xs font-mono text-neutral-400">/{c.slug}</span>
                    <span className="text-[10px] uppercase font-bold text-[#0E7C89] bg-[#0E7C89]/10 px-2 py-0.5 rounded">
                      {c.kind}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Order: {c.sort_order} • Status: {c.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-xs font-semibold transition-colors"
                  >
                    Edit
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id, c.name)}
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

      {/* Add / Edit Form (1 Col) */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0B1F23]">
          {editingCategory ? `Edit Category: ${editingCategory.name}` : "Add New Category"}
        </h2>

        <form action={saveCategoryAction} className="space-y-3">
          {editingCategory && <input type="hidden" name="id" value={editingCategory.id} />}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Category Name *
            </label>
            <input
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!editingCategory) setSlug(slugify(e.target.value));
              }}
              placeholder="e.g. Leather Boots"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              URL Slug *
            </label>
            <input
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="leather-boots"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Category Type
            </label>
            <select
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            >
              <option value="category">Standard Category</option>
              <option value="collection">Curated Collection</option>
              <option value="trending">Trending Now</option>
              <option value="seasonal">Seasonal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Parent Category (Optional)
            </label>
            <select
              name="parentId"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
            >
              <option value="">None (Top-level Category)</option>
              {categories
                .filter((c) => !editingCategory || c.id !== editingCategory.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Header Image URL (Optional)
            </label>
            <input
              name="imageUrl"
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
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
              {editingCategory ? "Save Category" : "Create Category"}
            </button>
            {editingCategory && (
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
