"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShopCategory } from "@/lib/actions/shop-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";

export function CategoryForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await createShopCategory({ slug, nameZh, nameEn, nameAr });
    setLoading(false);
    if (!result.success) {
      setError(result.error || "创建失败");
      return;
    }
    router.refresh();
    setSlug("");
    setNameZh("");
    setNameEn("");
    setNameAr("");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border border-border rounded-lg p-4 mb-6">
      <h2 className="font-medium">新建品类</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <FormGroup label="Slug" htmlFor="slug" required>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="rings" required />
        </FormGroup>
        <FormGroup label="中文名" htmlFor="nameZh" required>
          <Input id="nameZh" value={nameZh} onChange={(e) => setNameZh(e.target.value)} required />
        </FormGroup>
        <FormGroup label="英文名" htmlFor="nameEn" required>
          <Input id="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
        </FormGroup>
        <FormGroup label="阿拉伯文名" htmlFor="nameAr" required>
          <Input id="nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
        </FormGroup>
      </div>
      <ErrorAlert message={error} />
      <Button type="submit" disabled={loading}>
        {loading ? "创建中..." : "创建品类"}
      </Button>
    </form>
  );
}
