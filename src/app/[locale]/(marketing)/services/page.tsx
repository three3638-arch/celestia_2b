import { getTranslations } from "next-intl/server";
import { shopCatalogUrl } from "@/lib/shop-routes";
import { buildMarketingPageMetadata } from "@/lib/marketing-metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.services" });
  return buildMarketingPageMetadata(locale, "/services", t("title"), t("description"));
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("marketing.services");
  const shopLink = shopCatalogUrl(locale);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <p className="text-muted-foreground leading-relaxed mb-8">{t("description")}</p>
      <ul className="space-y-4 mb-8">
        {(["retail", "custom", "wholesale"] as const).map((item) => (
          <li key={item} className="border border-border/60 rounded-lg p-4">
            <h2 className="font-medium mb-1">{t(`items.${item}.title`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`items.${item}.desc`)}</p>
          </li>
        ))}
      </ul>
      <a href={shopLink} className="text-primary hover:underline font-medium">
        {t("shopLink")} →
      </a>
    </div>
  );
}
