import Link from "next/link";
import { getAdminShopProducts } from "@/lib/actions/shop-product";
import { getShopInquiries } from "@/lib/actions/shop-inquiry";
import { getCurrentShopUser } from "@/lib/shop-auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ShopAdminDashboard() {
  const [products, inquiries, user] = await Promise.all([
    getAdminShopProducts(),
    getShopInquiries(),
    getCurrentShopUser(),
  ]);
  const isAdmin = user?.role === "SHOP_ADMIN";

  const activeProducts = products.filter((p) => p.status === "ACTIVE").length;
  const newInquiries = inquiries.filter((i) => i.status === "NEW").length;

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">2C 仪表盘</h1>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="商品总数" value={products.length} />
        <StatCard label="上架商品" value={activeProducts} />
        <StatCard label="待处理询价" value={newInquiries} />
      </div>
      <div className="flex gap-3">
        {isAdmin && (
          <Link href="/shop-admin/products/new" className={cn(buttonVariants())}>
            新建商品
          </Link>
        )}
        <Link href="/shop-admin/inquiries" className={cn(buttonVariants({ variant: "outline" }))}>
          查看询价
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
