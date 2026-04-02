"use client";

import { formatPrice } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface PriceDisplayProps {
  price: string | null;
  showLabel?: boolean;
  showDisclaimer?: boolean;
  size?: "sm" | "md" | "lg";
  isOutOfStock?: boolean;
}

export function PriceDisplay({
  price,
  showLabel = true,
  showDisclaimer = true,
  size = "md",
  isOutOfStock = false,
}: PriceDisplayProps) {
  const t = useTranslations("products");
  
  const sizeClasses = {
    sm: {
      label: "text-xs",
      price: "text-lg",
      disclaimer: "text-[10px]",
    },
    md: {
      label: "text-sm",
      price: "text-2xl",
      disclaimer: "text-xs",
    },
    lg: {
      label: "text-base",
      price: "text-3xl",
      disclaimer: "text-sm",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className="space-y-1">
      {showLabel && (
        <span className={`${classes.label} text-muted-foreground`}>
          {t("referencePrice")}
        </span>
      )}
      <div className={`${classes.price} font-bold text-primary`}>
        {isOutOfStock ? (
          <span className="text-muted-foreground line-through">
            {t("outOfStock")}
          </span>
        ) : price ? (
          formatPrice(price)
        ) : (
          <span className="text-muted-foreground">{t("selectOptions")}</span>
        )}
      </div>
      {showDisclaimer && !isOutOfStock && price && (
        <p className={`${classes.disclaimer} text-muted-foreground`}>
          {t("priceNote")}
        </p>
      )}
    </div>
  );
}
