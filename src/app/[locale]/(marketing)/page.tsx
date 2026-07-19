import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shopCatalogUrl } from "@/lib/shop-routes";

export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("marketing");
  const shopLink = shopCatalogUrl(locale);

  const features = ["craft", "quality", "service"] as const;

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-medium tracking-widest uppercase mb-4">
          {t("home.eyebrow")}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">{t("home.title")}</h1>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("home.subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <a href={shopLink} className={cn(buttonVariants({ size: "lg" }))}>
            {t("home.ctaShop")}
          </a>
          <Link href={`/${locale}/contact`} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            {t("home.ctaContact")}
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-20">
        {features.map((key) => (
          <div key={key} className="rounded-xl border border-border/60 p-6 bg-card/50">
            <h3 className="font-semibold text-lg mb-2">{t(`home.features.${key}.title`)}</h3>
            <p className="text-sm text-muted-foreground">{t(`home.features.${key}.desc`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
