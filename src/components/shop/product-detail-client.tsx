"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShopPriceDisplay } from "@/components/shop/price-display";
import { SaleCountdown } from "@/components/shop/sale-countdown";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shopInquiryPath } from "@/lib/shop-routes";

interface Variant {
  id: string;
  variantCode: string;
  name: string;
  stockStatus: string;
  currency: string;
  listPrice: string;
  currentPrice: string;
  isOnSale: boolean;
  saleEndsAt: Date | null;
  discountPercent: number | null;
}

interface ProductDetailClientProps {
  locale: string;
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    images: { id: string; url: string; thumbnailUrl: string | null }[];
    variants: Variant[];
  };
}

export function ProductDetailClient({ locale, product }: ProductDetailClientProps) {
  const t = useTranslations("shop.product");
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id || "");
  const [imageIndex, setImageIndex] = useState(0);
  const selected = product.variants.find((v) => v.id === selectedId) || product.variants[0];
  const displayImage = product.images[imageIndex] || product.images[0];

  if (!selected) {
    return <p className="p-8 text-muted-foreground">No variants available</p>;
  }

  const inquiryHref = shopInquiryPath(locale, { productId: product.id, variantId: selected.id });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square relative rounded-xl overflow-hidden bg-muted/30">
            {displayImage ? (
              <Image
                src={displayImage.url}
                alt={product.title}
                fill
                className="object-cover"
                priority
              />
            ) : null}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImageIndex(idx)}
                  className={cn(
                    "relative w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 transition-colors",
                    idx === imageIndex ? "border-primary" : "border-transparent"
                  )}
                >
                  <Image
                    src={img.thumbnailUrl || img.url}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-4">{product.title}</h1>

          <ShopPriceDisplay
            listPrice={selected.listPrice}
            currentPrice={selected.currentPrice}
            isOnSale={selected.isOnSale}
            discountPercent={selected.discountPercent}
            currency={selected.currency}
            size="lg"
            className="mb-2"
          />

          {selected.isOnSale && selected.saleEndsAt && (
            <SaleCountdown endsAt={selected.saleEndsAt} />
          )}

          <div className="mt-6">
            <p className="text-sm text-muted-foreground mb-2">{t("selectVariant")}</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md border transition-colors",
                    selectedId === v.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>

          {selected.stockStatus === "OUT_OF_STOCK" ? (
            <p className="mt-6 text-destructive">{t("outOfStock")}</p>
          ) : (
            <Link href={inquiryHref} className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex")}>
              {t("inquiry")}
            </Link>
          )}

          {product.description && (
            <div className="mt-8 pt-8 border-t border-border/60">
              <h2 className="font-semibold mb-2">{t("description")}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
