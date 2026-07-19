"use client";

import { updateShopProductStatus } from "@/lib/actions/shop-product";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { ShopProductStatus } from "@prisma/client";

const labels: Record<ShopProductStatus, string> = {
  ACTIVE: "上架",
  INACTIVE: "下架",
  DRAFT: "草稿",
};

export function ProductStatusButton({
  id,
  status,
  current,
}: {
  id: string;
  status: ShopProductStatus;
  current: ShopProductStatus;
}) {
  const router = useRouter();
  if (status === current) return null;

  const update = async () => {
    await updateShopProductStatus(id, status);
    router.refresh();
  };

  return (
    <Button size="sm" variant="outline" onClick={update}>
      {labels[status]}
    </Button>
  );
}
