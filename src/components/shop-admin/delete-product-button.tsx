"use client";

import { deleteShopProduct } from "@/lib/actions/shop-product";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();

  const onDelete = async () => {
    if (!confirm("确定删除该商品？此操作不可恢复。")) return;
    const result = await deleteShopProduct(productId);
    if (!result.success) {
      alert(result.error || "删除失败");
      return;
    }
    router.push("/shop-admin/products");
    router.refresh();
  };

  return (
    <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
      删除商品
    </Button>
  );
}
