import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { locales, type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function StorefrontRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  // RTL 语言设置
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider messages={messages}>
      <NuqsAdapter>
        <StorefrontLayout dir={dir} locale={locale}>
          {children}
        </StorefrontLayout>
      </NuqsAdapter>
    </NextIntlClientProvider>
  );
}
