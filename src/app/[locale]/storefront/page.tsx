"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductGrid, EmptyProductState } from "@/components/storefront/product-grid";
import { getProducts } from "@/lib/actions/product";
import { getCategories } from "@/lib/actions/category";
import { getUserFavoriteIds } from "@/lib/actions/favorite";
import { getUserHiddenIds } from "@/lib/actions/hidden";
import type { ProductListItem } from "@/lib/actions/product";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations } from "next-intl";

// 排序选项（使用翻译函数在组件内部定义）
const getSortOptions = (t: (key: string) => string) => [
  { value: "newest", label: t("sortNewest") },
  { value: "price_asc", label: t("sortPriceAsc") },
  { value: "price_desc", label: t("sortPriceDesc") },
  { value: "popular", label: t("sortPopular") },
] as const;

// 宝石类型选项（使用翻译函数在组件内部定义）
const getGemTypeOptions = (t: (key: string) => string): { value: GemType; label: string }[] => [
  { value: "MOISSANITE", label: t("moissanite") },
  { value: "ZIRCON", label: t("zircon") },
];

// 金属底色选项（使用翻译函数在组件内部定义）
const getMetalColorOptions = (t: (key: string) => string): { value: MetalColor; label: string }[] => [
  { value: "SILVER", label: t("silver") },
  { value: "GOLD", label: t("gold") },
  { value: "ROSE_GOLD", label: t("roseGold") },
  { value: "OTHER", label: t("other") },
];

export default function StorefrontHomePage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("products");

  // 获取翻译后的选项
  const sortOptions = getSortOptions(t);
  const gemTypeOptions = getGemTypeOptions(t);
  const metalColorOptions = getMetalColorOptions(t);

  // URL 状态
  const [keyword, setKeyword] = useQueryState("keyword", {
    defaultValue: "",
    throttleMs: 300,
  });
  const [categoryId, setCategoryId] = useQueryState("categoryId", {
    defaultValue: "",
  });
  const [gemType, setGemType] = useQueryState("gemType", {
    defaultValue: "",
  });
  const [metalColor, setMetalColor] = useQueryState("metalColor", {
    defaultValue: "",
  });
  const [sortBy, setSortBy] = useQueryState("sortBy", {
    defaultValue: "newest",
  });

  // 本地状态
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<
    { id: string; nameZh: string; nameEn: string; nameAr: string; sortOrder: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [searchInput, setSearchInput] = useState(keyword);

  // 收藏和隐藏状态
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  // 筛选面板状态
  const [selectedGemTypes, setSelectedGemTypes] = useState<GemType[]>(
    gemType ? [gemType as GemType] : []
  );
  const [selectedMetalColors, setSelectedMetalColors] = useState<MetalColor[]>(
    metalColor ? [metalColor as MetalColor] : []
  );

  // Intersection Observer ref
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(searchInput || null);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, setKeyword]);

  // 加载品类
  useEffect(() => {
    const loadCategories = async () => {
      const data = await getCategories();
      setCategories(data);
    };
    loadCategories();
  }, []);

  // 加载收藏和隐藏列表
  useEffect(() => {
    const loadFavoriteAndHiddenIds = async () => {
      const [favoriteResult, hiddenResult] = await Promise.all([
        getUserFavoriteIds(),
        getUserHiddenIds(),
      ]);
      
      if (favoriteResult.success && favoriteResult.data) {
        setFavoriteIds(new Set(favoriteResult.data.productIds));
      }
      if (hiddenResult.success && hiddenResult.data) {
        setHiddenIds(new Set(hiddenResult.data.productIds));
      }
    };
    loadFavoriteAndHiddenIds();
  }, []);

  // 加载商品
  const loadProducts = useCallback(
    async (cursor?: string, reset = false) => {
      if (loading) return;

      setLoading(true);
      try {
        const response = await getProducts({
          categoryId: categoryId || undefined,
          gemType: (gemType as GemType) || undefined,
          metalColor: (metalColor as MetalColor) || undefined,
          keyword: keyword || undefined,
          sortBy: sortBy as "price_asc" | "price_desc" | "newest" | "popular",
          cursor,
          pageSize: 20,
        });

        if (reset) {
          setProducts(response.items);
        } else {
          setProducts((prev) => [...prev, ...response.items]);
        }
        setHasMore(response.hasMore);
        setNextCursor(response.nextCursor);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [categoryId, gemType, metalColor, keyword, sortBy, loading]
  );

  // 初始加载和筛选变化时重置
  useEffect(() => {
    setProducts([]);
    setHasMore(true);
    setNextCursor(undefined);
    loadProducts(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, gemType, metalColor, keyword, sortBy]);

  // 无限滚动
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadProducts(nextCursor);
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
  }, [hasMore, loading, nextCursor, loadProducts]);

  // 处理品类选择
  const handleCategorySelect = (id: string) => {
    setCategoryId(id === categoryId ? null : id);
  };

  // 处理筛选应用
  const handleApplyFilters = () => {
    setGemType(selectedGemTypes[0] || null);
    setMetalColor(selectedMetalColors[0] || null);
  };

  // 清除筛选
  const handleClearFilters = () => {
    setSelectedGemTypes([]);
    setSelectedMetalColors([]);
    setGemType(null);
    setMetalColor(null);
  };

  // 获取品类名称
  const getCategoryName = (category: (typeof categories)[0]) => {
    if (locale === "zh") return category.nameZh;
    if (locale === "ar") return category.nameAr;
    return category.nameEn;
  };

  // 处理收藏切换
  const handleToggleFavorite = (productId: string, isFavorited: boolean) => {
    setFavoriteIds((prev) => {
      const newSet = new Set(prev);
      if (isFavorited) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  };

  // 处理隐藏商品
  const handleHidden = (productId: string) => {
    setHiddenIds((prev) => new Set(prev).add(productId));
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // 计算活跃筛选数量
  const activeFilterCount =
    (gemType ? 1 : 0) + (metalColor ? 1 : 0);

  return (
    <div className="min-h-screen pb-20">
      {/* 搜索栏 */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="ps-10 bg-muted border-0"
            />
          </div>
        </div>

        {/* 品类标签横向滚动 */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => handleCategorySelect("")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                !categoryId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("allCategories")}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  categoryId === category.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {getCategoryName(category)}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      {/* 筛选与排序栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        {/* 筛选按钮 */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="gap-2 relative"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t("filter")}
                {activeFilterCount > 0 && (
                  <Badge
                    variant="default"
                    className="absolute -top-2 -end-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                  >
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <SheetContent side="left" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>{t("filter")}</SheetTitle>
            </SheetHeader>
            <div className="py-6 space-y-6">
              {/* 宝石类型筛选 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">{t("gemType")}</h4>
                <div className="space-y-2">
                  {gemTypeOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedGemTypes.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedGemTypes([option.value]);
                          } else {
                            setSelectedGemTypes([]);
                          }
                        }}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 金属底色筛选 */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">{t("metalColor")}</h4>
                <div className="space-y-2">
                  {metalColorOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMetalColors.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMetalColors([option.value]);
                          } else {
                            setSelectedMetalColors([]);
                          }
                        }}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 应用按钮 */}
              <div className="pt-4 space-y-2">
                <Button onClick={handleApplyFilters} className="w-full">
                  {t("filter")}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="w-full"
                >
                  {t("allCategories")}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* 排序选择 */}
        <Select value={sortBy} onValueChange={(value) => setSortBy(value || 'newest')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("sort")} />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 商品网格 */}
      <div className="px-4 py-4">
        {initialLoading ? (
          <ProductGrid products={[]} locale={locale} loading={true} />
        ) : products.length === 0 ? (
          <EmptyProductState />
        ) : (
          <>
            <ProductGrid 
              products={products.filter((p) => !hiddenIds.has(p.id))} 
              locale={locale}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
              onHidden={handleHidden}
            />

            {/* 加载更多指示器 */}
            <div ref={loadMoreRef} className="py-4">
              {loading && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  {t("noProducts")}
                </motion.p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
