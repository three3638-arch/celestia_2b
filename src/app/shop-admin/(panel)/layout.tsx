import { ShopAdminLayout } from "@/components/shop-admin/shop-admin-layout";
import { getCurrentShopUser } from "@/lib/shop-auth";
import { assertShopJwtConfigured } from "@/lib/shop-jwt-config";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  assertShopJwtConfigured();
  const user = await getCurrentShopUser();
  const isAdmin = user?.role === "SHOP_ADMIN";
  return <ShopAdminLayout isAdmin={isAdmin}>{children}</ShopAdminLayout>;
}
