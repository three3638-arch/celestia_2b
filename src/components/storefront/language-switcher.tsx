"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { locales, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "next/navigation";

const languageLabels: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  zh: "中文",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("profile");

  const handleLanguageChange = (newLocale: string | null) => {
    if (!newLocale) return;
    // 替换 URL 中的 locale 前缀
    const newPathname = pathname.replace(/^\/(en|ar|zh)/, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("language")}:</span>
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px]" size="sm">
          <SelectValue placeholder={languageLabels[locale as Locale]} />
        </SelectTrigger>
        <SelectContent>
          {locales.map((loc) => (
            <SelectItem key={loc} value={loc}>
              {languageLabels[loc]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
