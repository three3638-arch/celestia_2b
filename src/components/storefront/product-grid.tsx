"use client";

import { ProductCard, ProductCardSkeleton } from "./product-card";
import type { ProductListItem } from "@/lib/actions/product";
import { useTranslations } from "next-intl";

interface ProductGridProps {
  products: ProductListItem[];
  locale: string;
  loading?: boolean;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (productId: string, isFavorited: boolean) => void;
  onHidden?: (productId: string) => void;
}

export function ProductGrid({ 
  products, 
  locale, 
  loading = false,
  favoriteIds,
  onToggleFavorite,
  onHidden,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          locale={locale}
          index={index}
          isFavorited={favoriteIds?.has(product.id)}
          onToggleFavorite={onToggleFavorite}
          onHidden={onHidden}
        />
      ))}
      {loading && (
        <>
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </>
      )}
    </div>
  );
}

// 空状态组件
export function EmptyProductState() {
  const t = useTranslations("products");
  
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {t("noProducts")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {t("tryAdjusting")}
      </p>
    </div>
  );
}
