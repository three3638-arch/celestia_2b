"use client";

import { cn } from "@/lib/utils";

interface ShopPriceDisplayProps {
  listPrice: string;
  currentPrice: string;
  isOnSale: boolean;
  discountPercent?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ShopPriceDisplay({
  listPrice,
  currentPrice,
  isOnSale,
  discountPercent,
  currency = "SAR",
  size = "md",
  className,
}: ShopPriceDisplayProps) {
  const sizeClass =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className={cn("font-semibold text-primary", sizeClass)}>
        {currentPrice} {currency}
      </span>
      {isOnSale && (
        <>
          <span className="text-muted-foreground line-through text-sm">
            {listPrice} {currency}
          </span>
          {discountPercent != null && discountPercent > 0 && (
            <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
              -{discountPercent}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
