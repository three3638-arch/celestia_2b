"use client";

import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/lib/actions/product";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations } from "next-intl";

interface SkuSelectorProps {
  product: ProductDetail;
  selectedGemType: GemType | null;
  selectedMetalColor: MetalColor | null;
  selectedSize: string | null;
  selectedChainLength: string | null;
  onGemTypeChange: (gemType: GemType) => void;
  onMetalColorChange: (metalColor: MetalColor) => void;
  onSizeChange: (size: string) => void;
  onChainLengthChange: (chainLength: string) => void;
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

// 检查 SKU 是否缺货
function isSkuOutOfStock(
  product: ProductDetail,
  gemType: GemType,
  metalColor: MetalColor,
  size: string | null,
  chainLength: string | null
): boolean {
  const matchingSku = product.skus.find(
    (sku) =>
      sku.gemType === gemType &&
      sku.metalColor === metalColor &&
      (size === null || sku.size === size) &&
      (chainLength === null || sku.chainLength === chainLength)
  );
  return matchingSku?.stockStatus === "OUT_OF_STOCK";
}

// 获取选中 SKU 的价格
export function getSelectedSkuPrice(
  product: ProductDetail,
  gemType: GemType | null,
  metalColor: MetalColor | null,
  size: string | null,
  chainLength: string | null
): string | null {
  if (!gemType || !metalColor) return null;

  const matchingSku = product.skus.find(
    (sku) =>
      sku.gemType === gemType &&
      sku.metalColor === metalColor &&
      (size === null || sku.size === size) &&
      (chainLength === null || sku.chainLength === chainLength)
  );

  return matchingSku?.referencePriceSar || null;
}

// 检查 SKU 是否存在
export function isSkuAvailable(
  product: ProductDetail,
  gemType: GemType | null,
  metalColor: MetalColor | null,
  size: string | null,
  chainLength: string | null
): boolean {
  if (!gemType || !metalColor) return false;

  const matchingSku = product.skus.find(
    (sku) =>
      sku.gemType === gemType &&
      sku.metalColor === metalColor &&
      (size === null || sku.size === size) &&
      (chainLength === null || sku.chainLength === chainLength)
  );

  return !!matchingSku;
}

// 获取选中 SKU 的库存状态
export function getSelectedSkuStockStatus(
  product: ProductDetail,
  gemType: GemType | null,
  metalColor: MetalColor | null,
  size: string | null,
  chainLength: string | null
): "IN_STOCK" | "OUT_OF_STOCK" | "PRE_ORDER" | null {
  if (!gemType || !metalColor) return null;

  const matchingSku = product.skus.find(
    (sku) =>
      sku.gemType === gemType &&
      sku.metalColor === metalColor &&
      (size === null || sku.size === size) &&
      (chainLength === null || sku.chainLength === chainLength)
  );

  return matchingSku?.stockStatus || null;
}

export function SkuSelector({
  product,
  selectedGemType,
  selectedMetalColor,
  selectedSize,
  selectedChainLength,
  onGemTypeChange,
  onMetalColorChange,
  onSizeChange,
  onChainLengthChange,
}: SkuSelectorProps) {
  const t = useTranslations("products");
  
  // 获取所有可选的尺寸
  const availableSizes = Array.from(
    new Set(product.skus.map((sku) => sku.size).filter(Boolean))
  ) as string[];

  // 获取所有可选的链长度
  const availableChainLengths = Array.from(
    new Set(product.skus.map((sku) => sku.chainLength).filter(Boolean))
  ) as string[];

  // 检查宝石类型选项是否可用（基于当前已选条件）
  const isGemTypeAvailable = (gemType: GemType): boolean => {
    if (!selectedMetalColor) return true;
    return product.skus.some(
      (sku) =>
        sku.gemType === gemType &&
        sku.metalColor === selectedMetalColor &&
        (selectedSize === null || sku.size === selectedSize) &&
        (selectedChainLength === null || sku.chainLength === selectedChainLength)
    );
  };

  // 检查金属颜色选项是否可用
  const isMetalColorAvailable = (metalColor: MetalColor): boolean => {
    if (!selectedGemType) return true;
    return product.skus.some(
      (sku) =>
        sku.gemType === selectedGemType &&
        sku.metalColor === metalColor &&
        (selectedSize === null || sku.size === selectedSize) &&
        (selectedChainLength === null || sku.chainLength === selectedChainLength)
    );
  };

  // 检查尺寸选项是否可用
  const isSizeAvailable = (size: string): boolean => {
    if (!selectedGemType || !selectedMetalColor) return true;
    return product.skus.some(
      (sku) =>
        sku.gemType === selectedGemType &&
        sku.metalColor === selectedMetalColor &&
        sku.size === size &&
        (selectedChainLength === null || sku.chainLength === selectedChainLength)
    );
  };

  // 检查链长度选项是否可用
  const isChainLengthAvailable = (chainLength: string): boolean => {
    if (!selectedGemType || !selectedMetalColor) return true;
    return product.skus.some(
      (sku) =>
        sku.gemType === selectedGemType &&
        sku.metalColor === selectedMetalColor &&
        sku.chainLength === chainLength &&
        (selectedSize === null || sku.size === selectedSize)
    );
  };

  // 检查选项是否缺货
  const isOptionOutOfStock = (
    gemType: GemType,
    metalColor: MetalColor
  ): boolean => {
    return isSkuOutOfStock(
      product,
      gemType,
      metalColor,
      selectedSize,
      selectedChainLength
    );
  };

  return (
    <div className="space-y-5">
      {/* 宝石类型选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t("gemType")}
        </label>
        <div className="flex flex-wrap gap-2">
          {product.gemTypes.map((gemType) => {
            const isSelected = selectedGemType === gemType;
            const isAvailable = isGemTypeAvailable(gemType);
            const isOutOfStock =
              selectedMetalColor &&
              isOptionOutOfStock(gemType, selectedMetalColor);
            const disabled = !isAvailable || isOutOfStock;

            return (
              <button
                key={gemType}
                onClick={() => onGemTypeChange(gemType)}
                disabled={!!disabled}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200",
                  isSelected
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground bg-transparent",
                  disabled &&
                    "opacity-50 cursor-not-allowed line-through decoration-muted-foreground",
                  !disabled &&
                    !isSelected &&
                    "hover:border-primary/50 hover:text-primary"
                )}
              >
                {getGemTypeLabels(t)[gemType]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 金属底色选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t("metalColor")}
        </label>
        <div className="flex flex-wrap gap-2">
          {product.metalColors.map((metalColor) => {
            const isSelected = selectedMetalColor === metalColor;
            const isAvailable = isMetalColorAvailable(metalColor);
            const isOutOfStock =
              selectedGemType &&
              isOptionOutOfStock(selectedGemType, metalColor);
            const disabled = !isAvailable || isOutOfStock;

            return (
              <button
                key={metalColor}
                onClick={() => onMetalColorChange(metalColor)}
                disabled={!!disabled}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200",
                  isSelected
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground bg-transparent",
                  disabled &&
                    "opacity-50 cursor-not-allowed line-through decoration-muted-foreground",
                  !disabled &&
                    !isSelected &&
                    "hover:border-primary/50 hover:text-primary"
                )}
              >
                {getMetalColorLabels(t)[metalColor]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 尺寸选择 */}
      {availableSizes.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t("size")}</label>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((size) => {
              const isSelected = selectedSize === size;
              const isAvailable = isSizeAvailable(size);

              return (
                <button
                  key={size}
                  onClick={() => onSizeChange(size)}
                  disabled={!isAvailable}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 min-w-[48px]",
                    isSelected
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground bg-transparent",
                    !isAvailable &&
                      "opacity-50 cursor-not-allowed line-through decoration-muted-foreground",
                    isAvailable &&
                      !isSelected &&
                      "hover:border-primary/50 hover:text-primary"
                  )}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 链长度选择 */}
      {availableChainLengths.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("chainLength")}
          </label>
          <div className="flex flex-wrap gap-2">
            {availableChainLengths.map((chainLength) => {
              const isSelected = selectedChainLength === chainLength;
              const isAvailable = isChainLengthAvailable(chainLength);

              return (
                <button
                  key={chainLength}
                  onClick={() => onChainLengthChange(chainLength)}
                  disabled={!isAvailable}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200",
                    isSelected
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground bg-transparent",
                    !isAvailable &&
                      "opacity-50 cursor-not-allowed line-through decoration-muted-foreground",
                    isAvailable &&
                      !isSelected &&
                      "hover:border-primary/50 hover:text-primary"
                  )}
                >
                  {chainLength}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
