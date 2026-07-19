import { getTranslations } from "next-intl/server";
import { buildMarketingPageMetadata } from "@/lib/marketing-metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.about" });
  return buildMarketingPageMetadata(locale, "/about", t("title"), t("p1"));
}

export default async function AboutPage() {
  const t = await getTranslations("marketing.about");
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <p className="text-muted-foreground leading-relaxed mb-4">{t("p1")}</p>
      <p className="text-muted-foreground leading-relaxed">{t("p2")}</p>
    </div>
  );
}
