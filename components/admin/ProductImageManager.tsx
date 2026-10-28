"use client";

import { useState } from "react";
import { deleteProductImageAction } from "@/app/(admin)/admin/actions";

type ProductImage = {
  id: string;
  url: string;
  sort_order: number;
};

// Client-side image compression to WebP (max 1600px, 85% quality)
async function compressToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file);
        },
        "image/webp",
        0.85
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

export function ProductImageManager({
  productId,
  initialImages = [],
}: {
  productId: string;
  initialImages: ProductImage[];
}) {
  const [images, setImages] = useState<ProductImage[]>(
    [...initialImages].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [uploading, setUploading] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        // Compress in browser to WebP
        const compressedBlob = await compressToWebP(file);
        const webpFile = new File([compressedBlob], `${file.name.replace(/\.[^/.]+$/, "")}.webp`, {
          type: "image/webp",
        });

        const formData = new FormData();
        formData.append("productId", productId);
        formData.append("file", webpFile);

        const res = await fetch("/api/admin/upload-image", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Upload failed");
        }

        setImages((prev) => [...prev, data.image]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to upload one or more images.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      await deleteProductImageAction(imageId, productId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err: any) {
      alert(err?.message || "Failed to delete image");
    }
  };

  // Drag and drop reordering
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIdx];
    newImages.splice(draggedIdx, 1);
    newImages.splice(idx, 0, draggedItem);
    setDraggedIdx(idx);
    setImages(newImages);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* Upload Drop Zone */}
      <div className="border-2 border-dashed border-neutral-300 hover:border-[#0E7C89] rounded-2xl p-6 text-center bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
        <input
          type="file"
          id="product-images-input"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFilesSelected}
          disabled={uploading}
          className="hidden"
        />
        <label
          htmlFor="product-images-input"
          className="cursor-pointer flex flex-col items-center justify-center space-y-2"
        >
          <span className="text-3xl">📸</span>
          <span className="text-sm font-bold text-[#0B1F23]">
            {uploading ? "Compressing to WebP & Uploading..." : "Click or Drag to Upload Product Images"}
          </span>
          <span className="text-xs text-neutral-500">
            Automatically converted & compressed to high-performance WebP (Checked by magic bytes).
          </span>
        </label>
      </div>

      {/* Reorderable Image Grid */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-600">
              Drag images to reorder (First image is the primary storefront cover)
            </span>
            <span className="text-xs text-neutral-400">{images.length} images</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                className={`relative group rounded-xl overflow-hidden border-2 bg-neutral-100 aspect-square cursor-grab active:cursor-grabbing transition-all ${
                  idx === 0 ? "border-[#0E7C89] shadow-sm" : "border-neutral-200"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`Product view ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {idx === 0 && (
                  <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#0E7C89] text-white text-[10px] font-bold rounded-md shadow-xs">
                    Primary Cover
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
