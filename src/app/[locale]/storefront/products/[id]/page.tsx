"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Minus,
  Plus,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { SkuSelector, getSelectedSkuPrice, getSelectedSkuStockStatus } from "@/components/storefront/sku-selector";
import { PriceDisplay } from "@/components/storefront/price-display";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { getProductDetail } from "@/lib/actions/product";
import { getUserFavoriteIds } from "@/lib/actions/favorite";
import type { ProductDetail } from "@/lib/actions/product";
import type { GemType, MetalColor } from "@prisma/client";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const getGemTypeLabels = (t: (key: string) => string): Record<GemType, string> => ({
  MOISSANITE: t("moissanite"),
  ZIRCON: t("zircon"),
});

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as string) || "en";
  const productId = params.id as string;
  const t = useTranslations("products");

  // 状态
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  // SKU 选择状态
  const [selectedGemType, setSelectedGemType] = useState<GemType | null>(null);
  const [selectedMetalColor, setSelectedMetalColor] = useState<MetalColor | null>(null);
  const [selectedMainStoneSize, setSelectedMainStoneSize] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedChainLength, setSelectedChainLength] = useState<string | null>(null);

  // 数量
  const [quantity, setQuantity] = useState(1);

  // 描述展开状态
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // 加载商品详情
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        const data = await getProductDetail(productId);
        if (data) {
          setProduct(data);
          // 默认选中第一个宝石类型和金属颜色
          if (data.gemTypes.length > 0) {
            setSelectedGemType(data.gemTypes[0]);
          }
          if (data.metalColors.length > 0) {
            setSelectedMetalColor(data.metalColors[0]);
          }
          
          // 检查是否已收藏
          const favoriteResult = await getUserFavoriteIds();
          if (favoriteResult.success && favoriteResult.data) {
            setIsFavorited(favoriteResult.data.productIds.includes(productId));
          }
        } else {
          setError(t("noProducts"));
        }
      } catch {
        setError(t("noProducts"));
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  // 获取选中 SKU 的价格
  const selectedPrice = product
    ? getSelectedSkuPrice(
        product,
        selectedGemType,
        selectedMetalColor,
        selectedMainStoneSize,
        selectedSize,
        selectedChainLength
      )
    : null;

  // 获取选中 SKU 的库存状态
  const stockStatus = product
    ? getSelectedSkuStockStatus(
        product,
        selectedGemType,
        selectedMetalColor,
        selectedMainStoneSize,
        selectedSize,
        selectedChainLength
      )
    : null;

  const isOutOfStock = stockStatus === "OUT_OF_STOCK";

  // 获取商品名称
  const getProductName = () => {
    if (!product) return "";
    if (locale === "zh" && product.nameZh) return product.nameZh;
    if (locale === "ar" && product.nameAr) return product.nameAr;
    return product.nameEn || product.nameZh || product.spuCode || "Unnamed Product";
  };

  // 获取商品描述
  const getProductDescription = () => {
    if (!product) return "";
    if (locale === "zh" && product.descriptionZh) return product.descriptionZh;
    if (locale === "ar" && product.descriptionAr) return product.descriptionAr;
    return product.descriptionEn || product.descriptionZh || "";
  };

  // 获取品类名称
  const getCategoryName = () => {
    if (!product) return "";
    if (locale === "zh") return product.category.nameZh;
    if (locale === "ar") return product.category.nameAr;
    return product.category.nameEn;
  };

  // 处理数量变化
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  // 购物车 store
  const addItem = useCartStore(state => state.addItem);

  // 处理加入购物车
  const handleAddToCart = () => {
    if (!product) return;
      
    // 验证必要选项是否已选择
    // 如果商品有多个宝石类型选项，必须选择
    if (product.gemTypes.length > 1 && !selectedGemType) {
      toast.error(t("selectGemType"));
      return;
    }
      
    // 如果商品有多个金属底色选项，必须选择
    if (product.metalColors.length > 1 && !selectedMetalColor) {
      toast.error(t("selectMetalColor"));
      return;
    }
      
    // 获取所有可选的主石尺寸、尺寸和链长度
    const availableMainStoneSizes = Array.from(
      new Set(product.skus.map((sku) => sku.mainStoneSize).filter(Boolean))
    ) as string[];
    const availableSizes = Array.from(
      new Set(product.skus.map((sku) => sku.size).filter(Boolean))
    ) as string[];
    const availableChainLengths = Array.from(
      new Set(product.skus.map((sku) => sku.chainLength).filter(Boolean))
    ) as string[];
      
    // 如果商品有主石尺寸选项，必须选择
    if (availableMainStoneSizes.length > 0 && !selectedMainStoneSize) {
      toast.error(t("selectMainStoneSize"));
      return;
    }
      
    // 如果商品有尺码选项，必须选择
    if (availableSizes.length > 0 && !selectedSize) {
      toast.error(t("selectSize"));
      return;
    }
      
    // 如果商品有链长度选项，必须选择
    if (availableChainLengths.length > 0 && !selectedChainLength) {
      toast.error(t("selectChainLength"));
      return;
    }
      
    // 查找匹配的 SKU
    const selectedSku = product.skus.find(sku => {
      const gemMatch = selectedGemType ? sku.gemType === selectedGemType : true;
      const metalMatch = selectedMetalColor ? sku.metalColor === selectedMetalColor : true;
      const mainStoneSizeMatch = selectedMainStoneSize ? sku.mainStoneSize === selectedMainStoneSize : true;
      const sizeMatch = selectedSize ? sku.size === selectedSize : true;
      const chainMatch = selectedChainLength ? sku.chainLength === selectedChainLength : true;
      return gemMatch && metalMatch && mainStoneSizeMatch && sizeMatch && chainMatch;
    });
      
    if (!selectedSku) {
      toast.error(t("selectAllOptions"));
      return;
    }
      
    // 构建 SKU 描述
    const gemTypeLabels = getGemTypeLabels(t);
    const skuDescParts: string[] = [];
    if (selectedGemType) skuDescParts.push(gemTypeLabels[selectedGemType]);
    if (selectedMetalColor) skuDescParts.push(selectedMetalColor);
    if (selectedMainStoneSize) skuDescParts.push(`${selectedMainStoneSize}`);
    if (selectedSize) skuDescParts.push(`${t("size")} ${selectedSize}`);
    if (selectedChainLength) skuDescParts.push(`${selectedChainLength}cm`);
      
    // 添加商品到购物车
    addItem({
      skuId: selectedSku.id,
      productId: product.id,
      productName: getProductName(),
      skuDesc: skuDescParts.join(' / ') || 'Default',
      quantity: quantity,
      imageUrl: product.images[0]?.url,
      thumbnailUrl: product.images[0]?.thumbnailUrl || undefined,
      referencePriceSar: selectedSku.referencePriceSar?.toString(),
    });
  
    toast.success(t("added"));
  };

  // 返回上一页
  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-medium text-foreground">
            {error || t("noProducts")}
          </h1>
          <Button onClick={handleBack} variant="outline">
            <ChevronLeft className="w-4 h-4 me-2" />
            {t("back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="ms-2 font-medium truncate">{getProductName()}</span>
        </div>
      </div>

      {/* 图片轮播 */}
      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent>
            {product.images.map((image, index) => (
              <CarouselItem key={image.id}>
                <div className="relative aspect-square bg-muted">
                  <Image
                    src={image.url}
                    alt={`${getProductName()} - ${index + 1}`}
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {product.images.length > 1 && (
            <>
              <CarouselPrevious className="start-4" />
              <CarouselNext className="end-4" />
            </>
          )}
        </Carousel>

        {/* 图片指示器 */}
        {product.images.length > 1 && (
          <div className="absolute bottom-4 start-1/2 -translate-x-1/2 flex gap-1.5">
            {product.images.map((_, index) => (
              <div
                key={index}
                className="w-2 h-2 rounded-full bg-white/80"
              />
            ))}
          </div>
        )}
      </div>

      {/* 商品信息 */}
      <div className="px-4 py-6 space-y-6">
        {/* 品类标签 */}
        <Badge variant="secondary" className="text-xs">
          {getCategoryName()}
        </Badge>

        {/* 商品名称 */}
        <h1 className="text-2xl font-bold text-foreground">
          {getProductName()}
        </h1>

        {/* 商品描述 */}
        {getProductDescription() && (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              <motion.div
                initial={false}
                animate={{
                  height: descriptionExpanded ? "auto" : 60,
                }}
                className="overflow-hidden"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getProductDescription()}
                </p>
              </motion.div>
            </AnimatePresence>
            {getProductDescription().length > 100 && (
              <button
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                className="text-sm text-primary hover:underline"
              >
                {descriptionExpanded ? t("showLess") : t("showMore")}
              </button>
            )}
          </div>
        )}

        {/* 宝石类型标签 */}
        <div className="flex flex-wrap gap-2">
          {product.gemTypes.map((gemType) => (
            <Badge
              key={gemType}
              variant="outline"
              className="border-primary/30 text-primary"
            >
              {getGemTypeLabels(t)[gemType]}
            </Badge>
          ))}
        </div>

        {/* SKU 选择器 */}
        <div className="pt-4 border-t border-border">
          <SkuSelector
            product={product}
            selectedGemType={selectedGemType}
            selectedMetalColor={selectedMetalColor}
            selectedMainStoneSize={selectedMainStoneSize}
            selectedSize={selectedSize}
            selectedChainLength={selectedChainLength}
            onGemTypeChange={setSelectedGemType}
            onMetalColorChange={setSelectedMetalColor}
            onMainStoneSizeChange={setSelectedMainStoneSize}
            onSizeChange={setSelectedSize}
            onChainLengthChange={setSelectedChainLength}
          />
        </div>

        {/* 参考价展示 */}
        <div className="pt-4 border-t border-border">
          <PriceDisplay
            price={selectedPrice}
            isOutOfStock={isOutOfStock}
            size="lg"
          />
        </div>
      </div>

      {/* 底部浮层操作栏 */}
      <div className="fixed bottom-14 start-0 end-0 z-50 bg-background border-t border-border md:bottom-0 md:start-auto md:end-auto md:max-w-md md:mx-auto md:w-full">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            {/* 收藏按钮 */}
            {product && (
              <FavoriteButton
                productId={product.id}
                initialFavorited={isFavorited}
                onToggle={setIsFavorited}
                className="shrink-0"
              />
            )}

            {/* 数量选择 */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => handleQuantityChange(1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* 加入购物车按钮 */}
            <Button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="flex-1 h-12 text-base font-semibold"
              size="lg"
            >
              {isOutOfStock ? (
                t("outOfStock")
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 me-2" />
                  {t("addToCart")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 骨架屏组件
function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen pb-32">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-5 w-32 ms-2" />
        </div>
      </div>

      {/* 图片区域 */}
      <Skeleton className="aspect-square" />

      {/* 商品信息 */}
      <div className="px-4 py-6 space-y-6">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-8 w-32" />

        {/* SKU 选择器骨架 */}
        <div className="space-y-4 pt-4 border-t border-border">
          <Skeleton className="h-6 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
          <Skeleton className="h-6 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        {/* 价格骨架 */}
        <div className="pt-4 border-t border-border">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* 底部操作栏骨架 */}
      <div className="fixed bottom-14 start-0 end-0 z-50 bg-background border-t border-border px-4 py-4 md:bottom-0">
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
