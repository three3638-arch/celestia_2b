import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/marketing/contact-form";
import { buildMarketingPageMetadata } from "@/lib/marketing-metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.contact" });
  return buildMarketingPageMetadata(locale, "/contact", t("title"), t("description"));
}

export default async function ContactPage() {
  const t = await getTranslations("marketing.contact");
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@celestia.com";
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE || "";
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("description")}</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4 rounded-xl border border-border/60 p-6 bg-card/30 h-fit">
          <h2 className="font-semibold">{t("infoTitle")}</h2>
          <div>
            <p className="text-sm text-muted-foreground">{t("emailLabel")}</p>
            <p className="font-medium">{contactEmail}</p>
          </div>
          {contactPhone && (
            <div>
              <p className="text-sm text-muted-foreground">{t("phoneLabel")}</p>
              <p className="font-medium">{contactPhone}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{t("hoursLabel")}</p>
            <p className="font-medium">{t("hours")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 p-6 bg-card/30">
          <h2 className="font-semibold mb-4">{t("formTitle")}</h2>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
