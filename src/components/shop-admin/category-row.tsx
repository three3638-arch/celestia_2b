"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShopCategory, deleteShopCategory } from "@/lib/actions/shop-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import type { ShopCategoryStatus } from "@prisma/client";

interface CategoryRowProps {
  category: {
    id: string;
    slug: string;
    nameZh: string;
    nameEn: string;
    nameAr: string;
    status: ShopCategoryStatus;
  };
  isAdmin: boolean;
}

export function CategoryRow({ category, isAdmin }: CategoryRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState(category.slug);
  const [nameZh, setNameZh] = useState(category.nameZh);
  const [nameEn, setNameEn] = useState(category.nameEn);
  const [nameAr, setNameAr] = useState(category.nameAr);
  const [status, setStatus] = useState(category.status);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    setError("");
    const result = await updateShopCategory(category.id, { slug, nameZh, nameEn, nameAr, status });
    setLoading(false);
    if (!result.success) {
      setError(result.error || "保存失败");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("确定删除该品类？")) return;
    setLoading(true);
    const result = await deleteShopCategory(category.id);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "删除失败");
      return;
    }
    router.refresh();
  };

  if (!editing) {
    return (
      <tr className="border-t border-border">
        <td className="p-3">{category.slug}</td>
        <td className="p-3">{category.nameZh}</td>
        <td className="p-3">{category.status}</td>
        <td className="p-3">
          <div className="flex gap-2">
            {isAdmin && (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                编辑
              </Button>
            )}
            {isAdmin && (
              <Button type="button" size="sm" variant="ghost" onClick={remove} disabled={loading}>
                删除
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border bg-muted/20">
      <td className="p-3" colSpan={4}>
        <div className="grid sm:grid-cols-2 gap-3">
          <FormGroup label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </FormGroup>
          <FormGroup label="状态">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ShopCategoryStatus)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </FormGroup>
          <FormGroup label="中文名">
            <Input value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
          </FormGroup>
          <FormGroup label="英文名">
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </FormGroup>
          <FormGroup label="阿拉伯文名">
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </FormGroup>
        </div>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        <div className="flex gap-2 mt-3">
          <Button type="button" size="sm" onClick={save} disabled={loading}>
            保存
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            取消
          </Button>
        </div>
      </td>
    </tr>
  );
}
