import { ShopLayoutShell } from "@/components/shop/shop-layout";
import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { locales } from "@/i18n/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shop.catalog" });
  const base = process.env.NEXT_PUBLIC_SHOP_URL || "http://localhost:3000";
  return {
    title: `Celestia Shop — ${t("title")}`,
    description: t("title"),
    alternates: { canonical: `${base.replace(/\/$/, "")}/${locale}` },
  };
}

export default async function ShopRootLayout({
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
      <ShopLayoutShell dir={dir}>{children}</ShopLayoutShell>
    </NextIntlClientProvider>
  );
}
