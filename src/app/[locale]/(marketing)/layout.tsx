import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { locales } from "@/i18n/config";
import type { Metadata } from "next";

const marketingBase = () =>
  (process.env.NEXT_PUBLIC_MARKETING_URL || "http://localhost:3000").replace(/\/$/, "");

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  const base = marketingBase();
  const title = `Celestia — ${t("nav.home")}`;
  const description = t("home.subtitle");
  return {
    title: { default: title, template: "%s | Celestia" },
    description,
    alternates: { canonical: `${base}/${locale}` },
    openGraph: {
      title,
      description,
      url: `${base}/${locale}`,
      siteName: "Celestia Jewelry",
      type: "website",
    },
  };
}

export default async function MarketingRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider messages={messages}>
      <MarketingLayout dir={dir}>{children}</MarketingLayout>
    </NextIntlClientProvider>
  );
}
