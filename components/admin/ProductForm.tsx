"use client";

import { useState } from "react";
import Link from "next/link";
import { saveProductAction } from "@/app/(admin)/admin/actions";
import { slugify } from "@/lib/validation";

type Brand = { id: string; name: string };
type Category = { id: string; name: string };

export function ProductForm({
  initialProduct,
  brands = [],
  categories = [],
}: {
  initialProduct?: any;
  brands: Brand[];
  categories: Category[];
}) {
  const [name, setName] = useState(initialProduct?.name || "");
  const [slug, setSlug] = useState(initialProduct?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!initialProduct);

  const [priceEgp, setPriceEgp] = useState(
    initialProduct?.price_piasters ? (initialProduct.price_piasters / 100).toString() : ""
  );
  const [compareEgp, setCompareEgp] = useState(
    initialProduct?.compare_at_piasters
      ? (initialProduct.compare_at_piasters / 100).toString()
      : ""
  );

  const selectedCategoryIds = new Set(
    (initialProduct?.product_categories || []).map((c: any) => c.category_id)
  );

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  return (
    <form action={saveProductAction} className="space-y-6">
      {initialProduct?.id && (
        <input type="hidden" name="id" value={initialProduct.id} />
      )}

      {/* Main Grid: Left 2 Cols (Details, SEO) & Right 1 Col (Pricing, Status, Brand) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Details Card */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#0B1F23]">Product Information</h2>

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-neutral-700 mb-1">
                Product Title (English) *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Classic Oxford Leather Loafers"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="slug" className="block text-xs font-semibold text-neutral-700">
                  URL Handle (Slug) *
                </label>
                <button
                  type="button"
                  onClick={() => setAutoSlug(!autoSlug)}
                  className="text-[11px] text-[#0E7C89] font-semibold hover:underline"
                >
                  {autoSlug ? "Unlock Manual Edit" : "Auto-generate"}
                </button>
              </div>
              <div className="flex items-center rounded-xl border border-neutral-300 overflow-hidden px-3 py-2 bg-neutral-50">
                <span className="text-xs text-neutral-400 font-mono select-none">/product/</span>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setSlug(e.target.value);
                  }}
                  className="w-full bg-transparent text-xs font-mono text-[#0B1F23] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-semibold text-neutral-700 mb-1">
                Description & Material Specifications
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={initialProduct?.description || ""}
                placeholder="Handcrafted premium leather shoe with cushioned insole and non-slip rubber sole..."
                className="w-full p-3 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>
          </div>

          {/* Search Engine Optimization (SEO) */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#0B1F23]">Search Engine Optimization (SEO)</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Optimize how this shoe appears on Google Search and social sharing previews.
              </p>
            </div>

            <div>
              <label htmlFor="metaTitle" className="block text-xs font-semibold text-neutral-700 mb-1">
                SEO Meta Title
              </label>
              <input
                id="metaTitle"
                name="metaTitle"
                type="text"
                defaultValue={initialProduct?.meta_title || ""}
                placeholder={name ? `${name} | AKM Luxury Shoes` : "Product Name | AKM Luxury Shoes"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>

            <div>
              <label htmlFor="metaDescription" className="block text-xs font-semibold text-neutral-700 mb-1">
                SEO Meta Description
              </label>
              <textarea
                id="metaDescription"
                name="metaDescription"
                rows={3}
                defaultValue={initialProduct?.meta_description || ""}
                placeholder="Shop luxury footwear at AKM Luxury Shoes Alexandria. Fast delivery across Egypt."
                className="w-full p-3 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Pricing, Status, Organization */}
        <div className="space-y-6">
          {/* Pricing Card */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#0B1F23]">Pricing (Egyptian Pounds)</h2>

            <div>
              <label htmlFor="priceEgp" className="block text-xs font-semibold text-neutral-700 mb-1">
                Selling Price (EGP) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">EGP</span>
                <input
                  id="priceEgp"
                  name="priceEgp"
                  type="number"
                  step="1"
                  min="0"
                  required
                  value={priceEgp}
                  onChange={(e) => setPriceEgp(e.target.value)}
                  placeholder="1250"
                  className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="compareEgp" className="block text-xs font-semibold text-neutral-700 mb-1">
                Original Price (EGP) (Strike-through for sale)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">EGP</span>
                <input
                  id="compareEgp"
                  name="compareEgp"
                  type="number"
                  step="1"
                  min="0"
                  value={compareEgp}
                  onChange={(e) => setCompareEgp(e.target.value)}
                  placeholder="1800"
                  className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-neutral-300 text-sm font-mono text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#0E7C89]"
                />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Leave empty if not on sale.
              </p>
            </div>
          </div>

          {/* Visibility & Badges */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#0B1F23]">Status & Badges</h2>

            <div>
              <label htmlFor="status" className="block text-xs font-semibold text-neutral-700 mb-1">
                Visibility Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={initialProduct?.status || "draft"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white"
              >
                <option value="draft">Draft (Hidden from store)</option>
                <option value="published">Published (Visible in store)</option>
                <option value="archived">Archived (Soft deleted)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-neutral-100 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  name="isNewArrival"
                  defaultChecked={initialProduct?.is_new_arrival}
                  className="w-4 h-4 rounded text-[#0E7C89] focus:ring-[#0E7C89]"
                />
                <span>Mark as &ldquo;New Arrival&rdquo;</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={initialProduct?.is_featured}
                  className="w-4 h-4 rounded text-[#0E7C89] focus:ring-[#0E7C89]"
                />
                <span>Feature on Homepage</span>
              </label>
            </div>
          </div>

          {/* Organization: Brand & Categories */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-[#0B1F23]">Organization</h2>

            <div>
              <label htmlFor="brandId" className="block text-xs font-semibold text-neutral-700 mb-1">
                Brand
              </label>
              <select
                id="brandId"
                name="brandId"
                defaultValue={initialProduct?.brand_id || ""}
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E7C89] bg-white font-medium"
              >
                <option value="">No brand assigned</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Categories
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer hover:text-neutral-900"
                  >
                    <input
                      type="checkbox"
                      name="categoryIds"
                      value={c.id}
                      defaultChecked={selectedCategoryIds.has(c.id)}
                      className="w-3.5 h-3.5 rounded text-[#0E7C89] focus:ring-[#0E7C89]"
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="space-y-2">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>{initialProduct ? "Save Changes" : "Create Product"}</span>
            </button>

            {initialProduct?.slug && (
              <Link
                href={`/product/${initialProduct.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 hover:border-[#0E7C89] text-xs font-bold text-neutral-700 hover:text-[#0E7C89] transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Preview on Storefront ↗</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
