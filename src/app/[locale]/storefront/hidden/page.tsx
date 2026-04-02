"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Eye, Loader2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import {
  getHiddenProducts,
  toggleHidden,
} from "@/lib/actions/hidden";
import type { HiddenProductItem } from "@/lib/actions/hidden";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations } from "next-intl";
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

export default function HiddenProductsPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("products");
  const tHidden = useTranslations("hidden");

  // 宝石类型和金属颜色翻译
  const gemTypeLabels = getGemTypeLabels(t);
  const metalColorLabels = getMetalColorLabels(t);

  // 状态
  const [hiddenProducts, setHiddenProducts] = useState<HiddenProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Intersection Observer ref
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载隐藏商品列表
  const loadHiddenProducts = useCallback(
    async (cursor?: string, reset = false) => {
      if (loadingMore && !reset) return;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const response = await getHiddenProducts({
          cursor,
          pageSize: 20,
        });

        if (reset) {
          setHiddenProducts(response.items);
        } else {
          setHiddenProducts((prev) => [...prev, ...response.items]);
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
    loadHiddenProducts(undefined, true);
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
          loadHiddenProducts(nextCursor);
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
  }, [hasMore, loadingMore, nextCursor, loading, loadHiddenProducts]);

  // 恢复显示
  const handleRestore = async (hiddenId: string, productId: string) => {
    setRestoringId(hiddenId);
    try {
      const result = await toggleHidden(productId);
      if (result.success && result.data?.isHidden === false) {
        setHiddenProducts((prev) => prev.filter((h) => h.id !== hiddenId));
        toast.success(tHidden("productRestored"));
      } else {
        toast.error(result.error || tHidden("restoreFailed"));
      }
    } finally {
      setRestoringId(null);
    }
  };

  // 获取商品名称
  const getProductName = (product: HiddenProductItem) => {
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
  const formatPriceRange = (product: HiddenProductItem) => {
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
              {tHidden("title")}
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
  if (hiddenProducts.length === 0) {
    return (
      <div className="min-h-screen pb-20">
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center h-14 px-4">
            <h1 className="text-lg font-semibold text-foreground">
              {tHidden("title")}
            </h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-4 py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <EyeOff className="w-10 h-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center">
            {tHidden("noHiddenProducts")}
          </p>
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
            {tHidden("title")}
          </h1>
          <span className="ms-2 text-sm text-muted-foreground">
            ({hiddenProducts.length})
          </span>
        </div>
      </div>

      {/* 商品网格 */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {hiddenProducts.map((hidden, index) => (
            <motion.div
              key={hidden.id}
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
                  href={`/${locale}/storefront/products/${hidden.productId}`}
                  className="block"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {hidden.primaryImageThumbnailUrl || hidden.primaryImageUrl ? (
                      <Image
                        src={hidden.primaryImageThumbnailUrl || hidden.primaryImageUrl!}
                        alt={getProductName(hidden)}
                        fill
                        sizes="(max-width: 768px) 33vw, 25vw"
                        className="object-cover transition-transform duration-300 hover:scale-105 opacity-60"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <span className="text-muted-foreground text-xs">{t("noImage")}</span>
                      </div>
                    )}
                    {/* 隐藏标识 */}
                    <div className="absolute top-2 end-2">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <EyeOff className="w-3 h-3" />
                        {tHidden("hidden")}
                      </Badge>
                    </div>
                  </div>
                </Link>

                {/* 商品信息 */}
                <div className="p-3 space-y-2">
                  {/* 价格 */}
                  <p className="text-xs font-semibold text-primary">
                    {formatPriceRange(hidden)}
                  </p>

                  {/* 标签 */}
                  <div className="flex flex-wrap gap-1">
                    {hidden.gemTypes.slice(0, 1).map((gemType) => (
                      <Badge
                        key={gemType}
                        variant="secondary"
                        className="text-[10px] h-5 px-1.5"
                      >
                        {gemTypeLabels[gemType]}
                      </Badge>
                    ))}
                    {hidden.metalColors.slice(0, 1).map((metalColor) => (
                      <Badge
                        key={metalColor}
                        variant="outline"
                        className="text-[10px] h-5 px-1.5 border-primary/30 text-primary"
                      >
                        {metalColorLabels[metalColor]}
                      </Badge>
                    ))}
                  </div>

                  {/* 恢复显示按钮 */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1"
                    onClick={() => handleRestore(hidden.id, hidden.productId)}
                    disabled={restoringId === hidden.id}
                  >
                    {restoringId === hidden.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        {tHidden("showProduct")}
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
          {!hasMore && hiddenProducts.length > 0 && (
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
