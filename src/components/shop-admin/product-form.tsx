"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createShopProduct, updateShopProduct } from "@/lib/actions/shop-product";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  VariantPricingForm,
  emptyVariant,
  variantsToPayload,
  type VariantFormData,
} from "@/components/shop-admin/variant-pricing-form";
import type { ShopProductStatus } from "@prisma/client";

interface Category {
  id: string;
  nameZh: string;
}

interface ProductFormProps {
  categories: Category[];
  mode: "create" | "edit";
  productId?: string;
  initial?: {
    slug: string;
    titleZh: string;
    titleEn: string;
    titleAr: string;
    descriptionZh?: string;
    descriptionEn?: string;
    descriptionAr?: string;
    categoryId: string;
    status: ShopProductStatus;
    variants: VariantFormData[];
  };
}

export function ProductForm({ categories, mode, productId, initial }: ProductFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [slug, setSlug] = useState(initial?.slug || "");
  const [titleZh, setTitleZh] = useState(initial?.titleZh || "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn || "");
  const [titleAr, setTitleAr] = useState(initial?.titleAr || "");
  const [descriptionZh, setDescriptionZh] = useState(initial?.descriptionZh || "");
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn || "");
  const [descriptionAr, setDescriptionAr] = useState(initial?.descriptionAr || "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || "");
  const [status, setStatus] = useState<ShopProductStatus>(initial?.status || "ACTIVE");
  const [variants, setVariants] = useState<VariantFormData[]>(
    initial?.variants?.length ? initial.variants : [emptyVariant()]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = variantsToPayload(variants);
    const productData = {
      slug,
      titleZh,
      titleEn,
      titleAr,
      descriptionZh: descriptionZh || undefined,
      descriptionEn: descriptionEn || undefined,
      descriptionAr: descriptionAr || undefined,
      categoryId,
      status,
    };

    const result =
      mode === "create"
        ? await createShopProduct(productData, payload)
        : await updateShopProduct(productId!, productData, payload);

    setLoading(false);
    if (!result.success) {
      setError(result.error || "保存失败");
      return;
    }
    if (mode === "create" && result.data && typeof result.data === "object" && "id" in result.data) {
      router.push(`/shop-admin/products/${(result.data as { id: string }).id}/edit?created=1`);
    } else {
      router.push("/shop-admin/products");
    }
    router.refresh();
  };

  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground">
        请先{" "}
        <Link href="/shop-admin/categories" className="text-primary underline">
          创建品类
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <FormGroup label="Slug" htmlFor="slug" required>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </FormGroup>
        <FormGroup label="品类" htmlFor="categoryId" required>
          <select
            id="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameZh}
              </option>
            ))}
          </select>
        </FormGroup>
        <FormGroup label="中文标题" htmlFor="titleZh" required>
          <Input id="titleZh" value={titleZh} onChange={(e) => setTitleZh(e.target.value)} required />
        </FormGroup>
        <FormGroup label="英文标题" htmlFor="titleEn" required>
          <Input id="titleEn" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} required />
        </FormGroup>
        <FormGroup label="阿拉伯文标题" htmlFor="titleAr" required>
          <Input id="titleAr" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} required />
        </FormGroup>
        <FormGroup label="中文描述" htmlFor="descriptionZh">
          <textarea
            id="descriptionZh"
            value={descriptionZh}
            onChange={(e) => setDescriptionZh(e.target.value)}
            className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </FormGroup>
        <FormGroup label="英文描述" htmlFor="descriptionEn">
          <textarea
            id="descriptionEn"
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </FormGroup>
        <FormGroup label="阿拉伯文描述" htmlFor="descriptionAr">
          <textarea
            id="descriptionAr"
            value={descriptionAr}
            onChange={(e) => setDescriptionAr(e.target.value)}
            className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </FormGroup>
        {mode === "edit" && (
          <FormGroup label="状态" htmlFor="status">
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ShopProductStatus)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="ACTIVE">上架</option>
              <option value="INACTIVE">下架</option>
              <option value="DRAFT">草稿</option>
            </select>
          </FormGroup>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="font-medium mb-3">SKU / 定价</h3>
        <VariantPricingForm variants={variants} onChange={setVariants} />
      </div>

      <ErrorAlert message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "保存中..." : mode === "create" ? "创建商品" : "保存修改"}
        </Button>
        <Link href="/shop-admin/products" className={cn(buttonVariants({ variant: "outline" }))}>
          取消
        </Link>
      </div>
    </form>
  );
}
