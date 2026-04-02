"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import type { ProductListItem } from "@/lib/actions/product";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations } from "next-intl";
import { FavoriteButton } from "./favorite-button";
import { HiddenButton } from "./hidden-button";

interface ProductCardProps {
  product: ProductListItem;
  locale: string;
  index?: number;
  isFavorited?: boolean;
  onToggleFavorite?: (productId: string, isFavorited: boolean) => void;
  onHidden?: (productId: string) => void;
}

const getGemTypeLabels = (t: (key: string) => string): Record<GemType, string> => ({
  MOISSANITE: t("moissanite"),
  ZIRCON: t("zircon"),
});

const getMetalColorLabels = (t: (key: string) => string): Record<MetalColor, string> => ({
  SILVER: t("silver"),
  GOLD: t("gold"),
  ROSE_GOLD: t("roseGold"),
  OTHER: t("other"),
});

export function ProductCard({ 
  product, 
  locale, 
  index = 0,
  isFavorited = false,
  onToggleFavorite,
  onHidden,
}: ProductCardProps) {
  const t = useTranslations("products");
  
  // 获取商品名称（按优先级）
  const productName =
    (locale === "zh" && product.nameZh) ||
    (locale === "ar" && product.nameAr) ||
    product.nameEn ||
    product.nameZh ||
    product.spuCode ||
    t("noName");

  // 格式化价格区间
  const formatPriceRange = () => {
    const min = product.minPriceSar ? parseFloat(product.minPriceSar) : null;
    const max = product.maxPriceSar ? parseFloat(product.maxPriceSar) : null;

    if (min === null && max === null) return t("priceTbd") || "Price TBD";
    if (min === null) return formatPrice(max!);
    if (max === null) return formatPrice(min);
    if (min === max) return formatPrice(min);
    // 精简格式：SAR 80~100（只在第一个价格前显示 SAR）
    const minStr = formatPrice(min);
    const maxStr = formatPrice(max);
    const minNumber = minStr.replace(/[^\d.]/g, "");
    const maxNumber = maxStr.replace(/[^\d.]/g, "");
    const currencyPrefix = minStr.replace(/[\d.,]/g, "").trim();
    return `${currencyPrefix} ${minNumber}~${maxNumber}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: "easeOut",
      }}
    >
      <Link
        href={`/${locale}/storefront/products/${product.id}`}
        className="group block"
      >
        <div className="bg-card rounded-lg overflow-hidden border border-border transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
          {/* 商品图片 */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            {product.primaryImageThumbnailUrl || product.primaryImageUrl ? (
              <Image
                src={product.primaryImageThumbnailUrl || product.primaryImageUrl!}
                alt={productName}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <span className="text-muted-foreground text-xs">{t("noImage")}</span>
              </div>
            )}
            
            {/* 收藏和隐藏按钮 - 右上角 */}
            <div className="absolute top-2 end-2 flex flex-col gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
              <FavoriteButton
                productId={product.id}
                initialFavorited={isFavorited}
                onToggle={(favorited) => onToggleFavorite?.(product.id, favorited)}
              />
              <HiddenButton
                productId={product.id}
                onHidden={() => onHidden?.(product.id)}
              />
            </div>
          </div>

          {/* 商品信息 */}
          <div className="p-3 space-y-2">
            {/* 商品名称 */}
            <h3 className="hidden text-sm font-medium text-foreground line-clamp-1">
              {productName}
            </h3>

            {/* 价格 */}
            <p className="text-xs font-semibold text-primary">
              {formatPriceRange()}
            </p>

            {/* 标签 */}
            <div className="flex flex-wrap gap-1">
              {product.gemTypes.slice(0, 1).map((gemType) => (
                <Badge
                  key={gemType}
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5"
                >
                  {getGemTypeLabels(t)[gemType]}
                </Badge>
              ))}
              {product.metalColors.slice(0, 1).map((metalColor) => (
                <Badge
                  key={metalColor}
                  variant="outline"
                  className="text-[10px] h-5 px-1.5 border-primary/30 text-primary"
                >
                  {getMetalColorLabels(t)[metalColor]}
                </Badge>
              ))}
              {(product.gemTypes.length > 1 || product.metalColors.length > 1) && (
                <Badge
                  variant="ghost"
                  className="text-[10px] h-5 px-1.5 text-muted-foreground"
                >
                  +{product.gemTypes.length + product.metalColors.length - 2}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// 骨架屏组件
export function ProductCardSkeleton() {
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border">
      <Skeleton className="aspect-square" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}
