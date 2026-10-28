"use client";

import { useState } from "react";
import { saveHomepageSectionAction, deleteHomepageSectionAction } from "@/app/(admin)/admin/actions";

type Section = {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  source: string | null;
  category_id: string | null;
  config: any;
  sort_order: number;
  is_active: boolean;
};

export function HomepageSectionEditor({
  sections = [],
  categories = [],
  isOwner,
}: {
  sections: Section[];
  categories: { id: string; name: string }[];
  isOwner: boolean;
}) {
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [type, setType] = useState("product_row");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [source, setSource] = useState("featured");
  const [categoryId, setCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const startEdit = (s: Section) => {
    setEditingSection(s);
    setType(s.type);
    setTitle(s.title || "");
    setSubtitle(s.subtitle || "");
    setSource(s.source || "featured");
    setCategoryId(s.category_id || "");
    setSortOrder(s.sort_order.toString());
    setIsActive(s.is_active);
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setType("product_row");
    setTitle("");
    setSubtitle("");
    setSource("featured");
    setCategoryId("");
    setSortOrder("0");
    setIsActive(true);
  };

  const handleDelete = async (id: string, sTitle: string | null) => {
    if (!confirm(`Delete homepage section "${sTitle || "Section"}"?`)) return;
    try {
      await deleteHomepageSectionAction(id);
    } catch (err: any) {
      alert(err?.message || "Failed to delete section");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sections List (2 Cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1F23]">Active Homepage Layout</h2>
          <span className="text-xs text-neutral-400">{sections.length} blocks</span>
        </div>

        {!sections.length ? (
          <div className="p-8 text-center text-xs text-neutral-400">
            No sections found. Add a section using the form.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {sections.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0B1F23]">
                      {s.title || `Untitled ${s.type.replace("_", " ").toUpperCase()}`}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#0E7C89] bg-[#0E7C89]/10 px-2 py-0.5 rounded">
                      {s.type}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Order: {s.sort_order} • Source: {s.source || "None"} • Status: {s.is_active ? "Active" : "Hidden"}
                  </div>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-[#0E7C89] hover:text-white text-xs font-semibold transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.title)}
                      className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Form (1 Col) */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-[#0B1F23]">
          {editingSection ? `Edit Section` : "Add Homepage Block"}
        </h2>

        {!isOwner ? (
          <div className="p-4 rounded-xl bg-neutral-100 text-neutral-600 text-xs">
            Only the store owner can edit homepage layout sections.
          </div>
        ) : (
          <form action={saveHomepageSectionAction} className="space-y-3">
            {editingSection && <input type="hidden" name="id" value={editingSection.id} />}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Section Type *
              </label>
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              >
                <option value="hero">Hero Banner</option>
                <option value="product_row">Product Row (Grid / Carousel)</option>
                <option value="category_tiles">Category Visual Tiles</option>
                <option value="brand_row">Brand Logos Showcase</option>
                <option value="marquee">Scrolling Brand Marquee</option>
                <option value="promo_banner">Promotional Banner</option>
                <option value="trust_bar">Trust & Quality Badges</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Section Heading
              </label>
              <input
                name="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Featured Footwear"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Subtitle / Description
              </label>
              <input
                name="subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Handcrafted styles for the modern gentleman"
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            {type === "product_row" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Products Source
                  </label>
                  <select
                    name="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
                  >
                    <option value="featured">Featured Products</option>
                    <option value="new_arrivals">New Arrivals</option>
                    <option value="best_sellers">Best Sellers</option>
                    <option value="trending">Trending Now</option>
                    <option value="sale">On Sale / Discounted</option>
                    <option value="category">Specific Category</option>
                  </select>
                </div>

                {source === "category" && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Target Category
                    </label>
                    <select
                      name="categoryId"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                    >
                      <option value="">Select category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Sort Order
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
                {editingSection ? "Save Section" : "Create Block"}
              </button>
              {editingSection && (
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
        )}
      </div>
    </div>
  );
}
