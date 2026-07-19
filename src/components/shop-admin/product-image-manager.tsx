"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addShopProductImage, deleteShopProductImage } from "@/lib/actions/shop-product";
import { Button } from "@/components/ui/button";

interface ProductImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
}

export function ProductImageManager({
  productId,
  images: initialImages,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/shop-admin/upload/image", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "上传失败");
        return;
      }
      const result = await addShopProductImage(productId, data.data.url, data.data.thumbnailUrl);
      if (!result.success || !result.data) {
        setError(result.error || "保存失败");
        return;
      }
      const saved = result.data as ProductImage;
      setImages((prev) => [...prev, saved]);
      router.refresh();
    } catch {
      setError("上传失败");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const onDelete = async (imageId: string) => {
    const result = await deleteShopProductImage(imageId);
    if (!result.success) {
      setError(result.error || "删除失败");
      return;
    }
    setImages((prev) => prev.filter((i) => i.id !== imageId));
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative w-24 h-24 rounded border border-border overflow-hidden">
            <Image src={img.thumbnailUrl || img.url} alt="" fill className="object-cover" />
            <button
              type="button"
              onClick={() => onDelete(img.id)}
              className="absolute top-0 right-0 bg-destructive text-white text-xs px-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" onChange={onUpload} disabled={uploading} />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
