import Image from "next/image";
import { ShopPriceDisplay } from "@/components/shop/price-display";

export function InquiryProductSummary({
  title,
  imageUrl,
  variantName,
  listPrice,
  currentPrice,
  isOnSale,
  discountPercent,
  currency,
}: {
  title: string;
  imageUrl: string | null;
  variantName: string;
  listPrice: string;
  currentPrice: string;
  isOnSale: boolean;
  discountPercent: number | null;
  currency: string;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-border/60 p-4 mb-6 bg-card/30 max-w-md">
      {imageUrl && (
        <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted/30">
          <Image src={imageUrl} alt={title} fill className="object-cover" />
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium line-clamp-2">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{variantName}</p>
        <ShopPriceDisplay
          listPrice={listPrice}
          currentPrice={currentPrice}
          isOnSale={isOnSale}
          discountPercent={discountPercent}
          currency={currency}
          size="sm"
          className="mt-2"
        />
      </div>
    </div>
  );
}
