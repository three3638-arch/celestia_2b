import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { getShopCatalogProducts } from "@/lib/actions/shop-product";
import { getShopCategories } from "@/lib/actions/shop-category";
import { ShopProductCard } from "@/components/shop/shop-layout";
import { shopCatalogPath, shopProductPath } from "@/lib/shop-routes";

export default async function ShopCatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; sort?: string; sale?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("shop.catalog");

  const sortBy =
    sp.sort === "price_asc" || sp.sort === "price_desc" ? sp.sort : "newest";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [catalog, categories] = await Promise.all([
    getShopCatalogProducts({
      locale,
      categoryId: sp.category,
      sortBy,
      onSaleOnly: sp.sale === "1",
      page,
      pageSize: 24,
    }),
    getShopCategories(true),
  ]);

  const { items: products, hasMore, total } = catalog;

  const base = shopCatalogPath(locale);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterLink href={base} active={!sp.category && sp.sale !== "1"}>
          {t("allCategories")}
        </FilterLink>
        {categories.map((c) => (
          <FilterLink
            key={c.id}
            href={`${base}?category=${c.id}`}
            active={sp.category === c.id}
          >
            {locale === "zh" ? c.nameZh : locale === "ar" ? c.nameAr : c.nameEn}
          </FilterLink>
        ))}
        <FilterLink href={`${base}?sale=1`} active={sp.sale === "1"}>
          {t("onSale")}
        </FilterLink>
      </div>

      <div className="flex gap-2 mb-8 text-sm">
        <FilterLink href={`${base}${buildQuery(sp, { sort: "newest" })}`} active={sortBy === "newest"}>
          {t("sortNewest")}
        </FilterLink>
        <FilterLink href={`${base}${buildQuery(sp, { sort: "price_asc" })}`} active={sortBy === "price_asc"}>
          {t("sortPriceAsc")}
        </FilterLink>
        <FilterLink href={`${base}${buildQuery(sp, { sort: "price_desc" })}`} active={sortBy === "price_desc"}>
          {t("sortPriceDesc")}
        </FilterLink>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">{t("empty")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ShopProductCard
                key={p.id}
                href={shopProductPath(locale, p.slug)}
                title={p.title}
                imageUrl={p.imageUrl}
                minPrice={p.minPrice}
                maxPrice={p.maxPrice}
                hasOnSale={p.hasOnSale}
                fromLabel={t("from")}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <Link
                href={`${base}${buildQuery(sp, { page: String(page - 1) })}`}
                className="text-sm text-primary hover:underline"
              >
                {t("prevPage")}
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {t("pageInfo", { page, total: Math.ceil(total / 24) || 1 })}
            </span>
            {hasMore && (
              <Link
                href={`${base}${buildQuery(sp, { page: String(page + 1) })}`}
                className="text-sm text-primary hover:underline"
              >
                {t("nextPage")}
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

function buildQuery(
  sp: { category?: string; sort?: string; sale?: string; page?: string },
  overrides: { sort?: string; page?: string }
) {
  const params = new URLSearchParams();
  if (sp.category) params.set("category", sp.category);
  if (sp.sale) params.set("sale", sp.sale);
  if (overrides.sort ?? sp.sort) params.set("sort", overrides.sort ?? sp.sort!);
  if (overrides.page) params.set("page", overrides.page);
  else if (!overrides.sort && sp.page && sp.page !== "1") params.set("page", sp.page);
  const q = params.toString();
  return q ? `?${q}` : "";
}
