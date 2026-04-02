"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import {
  getFavoriteProducts,
  toggleFavorite,
} from "@/lib/actions/favorite";
import type { FavoriteProductItem } from "@/lib/actions/favorite";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";

// 宝石类型翻译
const getGemTypeLabels = (t: (key: string) => string): Record<GemType, string> => ({
  MOISSANITE: t("moissanite"),
  ZIRCON: t("zircon"),
});

// 金属颜色翻译
const getMetalColorLabels = (t: (key: string) => string): Record<MetalColor, string> => ({
  SILVER: t("silver"),
  GOLD: t("gold"),
  ROSE_GOLD: t("roseGold"),
  OTHER: t("other"),
});

export default function FavoritesPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("products");
  const tFavorites = useTranslations("favorites");
  const currentLocale = useLocale();

  // 宝石类型和金属颜色翻译
  const gemTypeLabels = getGemTypeLabels(t);
  const metalColorLabels = getMetalColorLabels(t);

  // 状态
  const [favorites, setFavorites] = useState<FavoriteProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Intersection Observer ref
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载收藏列表
  const loadFavorites = useCallback(
    async (cursor?: string, reset = false) => {
      if (loadingMore && !reset) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getFavoriteProducts({
          cursor,
          pageSize: 20,
        });

        if (reset) {
          setFavorites(response.items);
        } else {
          setFavorites((prev) => [...prev, ...response.items]);
        }
        setHasMore(response.hasMore);
        setNextCursor(response.nextCursor);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loadingMore]
  );

  // 初始加载
  useEffect(() => {
    loadFavorites(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadFavorites(nextCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, nextCursor, loading, loadFavorites]);

  // 取消收藏
  const handleRemoveFavorite = async (favoriteId: string, productId: string) => {
    setRemovingId(favoriteId);
    try {
      const result = await toggleFavorite(productId);
      if (result.success && result.data?.isFavorited === false) {
        setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
        toast.success(tFavorites("removedFromFavorites"));
      } else {
        toast.error(result.error || tFavorites("removeFailed"));
      }
    } finally {
      setRemovingId(null);
    }
  };

  // 获取商品名称
  const getProductName = (product: FavoriteProductItem) => {
    return (
      (locale === "zh" && product.nameZh) ||
      (locale === "ar" && product.nameAr) ||
      product.nameEn ||
      product.nameZh ||
      product.spuCode ||
      t("noName")
    );
  };

  // 格式化价格区间
  const formatPriceRange = (product: FavoriteProductItem) => {
    const min = product.minPriceSar ? parseFloat(product.minPriceSar) : null;
    const max = product.maxPriceSar ? parseFloat(product.maxPriceSar) : null;

    if (min === null && max === null) return t("priceTbd") || "Price TBD";
    if (min === null) return formatPrice(max!);
    if (max === null) return formatPrice(min);
    if (min === max) return formatPrice(min);

    const minStr = formatPrice(min);
    const maxStr = formatPrice(max);
    const minNumber = minStr.replace(/[^\d.]/g, "");
    const maxNumber = maxStr.replace(/[^\d.]/g, "");
    const currencyPrefix = minStr.replace(/[\d.,]/g, "").trim();
    return `${currencyPrefix} ${minNumber}~${maxNumber}`;
  };

  // 加载中骨架屏
  if (loading) {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center h-14 px-4">
            <h1 className="text-lg font-semibold text-foreground">
              {tFavorites("title")}
            </h1>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg overflow-hidden border border-border">
                <Skeleton className="aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 空状态
  if (favorites.length === 0) {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center h-14 px-4">
            <h1 className="text-lg font-semibold text-foreground">
              {tFavorites("title")}
            </h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-4 py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center mb-6">
            {tFavorites("noFavorites")}
          </p>
          <Link href={`/${locale}/storefront`}>
            <Button className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              {t("allCategories")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4">
          <h1 className="text-lg font-semibold text-foreground">
            {tFavorites("title")}
          </h1>
          <span className="ms-2 text-sm text-muted-foreground">
            ({favorites.length})
          </span>
        </div>
      </div>

      {/* 商品网格 */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {favorites.map((favorite, index) => (
            <motion.div
              key={favorite.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.3,
                delay: index * 0.03,
                ease: "easeOut",
              }}
            >
              <div className="bg-card rounded-lg overflow-hidden border border-border transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
                {/* 商品图片 */}
                <Link
                  href={`/${locale}/storefront/products/${favorite.productId}`}
                  className="block"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {favorite.primaryImageThumbnailUrl || favorite.primaryImageUrl ? (
                      <Image
                        src={favorite.primaryImageThumbnailUrl || favorite.primaryImageUrl!}
                        alt={getProductName(favorite)}
                        fill
                        sizes="(max-width: 768px) 33vw, 25vw"
                        className="object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground text-xs">{t("noImage")}</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* 商品信息 */}
                <div className="p-3 space-y-2">
                  {/* 价格 */}
                  <p className="text-xs font-semibold text-primary">
                    {formatPriceRange(favorite)}
                  </p>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1">
                    {favorite.gemTypes.slice(0, 1).map((gemType) => (
                      <Badge
                        key={gemType}
                        variant="secondary"
                        className="text-[10px] h-5 px-1.5"
                      >
                        {gemTypeLabels[gemType]}
                      </Badge>
                    ))}
                    {favorite.metalColors.slice(0, 1).map((metalColor) => (
                      <Badge
                        key={metalColor}
                        variant="outline"
                        className="text-[10px] h-5 px-1.5 border-primary/30 text-primary"
                      >
                        {metalColorLabels[metalColor]}
                      </Badge>
                    ))}
                  </div>

                  {/* 取消收藏按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemoveFavorite(favorite.id, favorite.productId)}
                    disabled={removingId === favorite.id}
                  >
                    {removingId === favorite.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Heart className="w-3 h-3 me-1 fill-current" />
                        {tFavorites("remove")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 加载更多指示器 */}
        <div ref={loadMoreRef} className="py-4">
          {loadingMore && (
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {!hasMore && favorites.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-muted-foreground"
            >
              {t("noProducts")}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
