import { getShopCategories } from "@/lib/actions/shop-category";
import { CategoryForm } from "@/components/shop-admin/category-form";
import { CategoryRow } from "@/components/shop-admin/category-row";
import { getCurrentShopUser } from "@/lib/shop-auth";

export default async function ShopCategoriesPage() {
  const [categories, user] = await Promise.all([getShopCategories(), getCurrentShopUser()]);
  const isAdmin = user?.role === "SHOP_ADMIN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">品类管理</h1>
      {isAdmin && <CategoryForm />}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Slug</th>
              <th className="text-left p-3">中文名</th>
              <th className="text-left p-3">状态</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
