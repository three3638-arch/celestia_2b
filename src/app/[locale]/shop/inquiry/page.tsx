import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InquiryForm } from "@/components/shop/inquiry-form";
import { InquiryProductSummary } from "@/components/shop/inquiry-product-summary";
import { getShopInquiryContext } from "@/lib/actions/shop-product";

export default async function ShopInquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ productId?: string; variantId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations("shop.inquiry");

  const context =
    sp.productId ? await getShopInquiryContext(sp.productId, sp.variantId, locale) : null;

  if (sp.productId && !context) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
      {context && (
        <InquiryProductSummary
          title={context.title}
          imageUrl={context.imageUrl}
          variantName={context.variantName}
          listPrice={context.listPrice}
          currentPrice={context.currentPrice}
          isOnSale={context.isOnSale}
          discountPercent={context.discountPercent}
          currency={context.currency}
        />
      )}
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <InquiryForm />
      </Suspense>
    </div>
  );
}
