"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { shopCatalogPath } from "@/lib/shop-routes";
import { Button } from "@/components/ui/button";

export function ShopLayoutShell({
  children,
  dir,
}: {
  children: React.ReactNode;
  dir: "ltr" | "rtl";
}) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const pathname = usePathname();
  const base = shopCatalogPath(locale);
  const [mobileOpen, setMobileOpen] = useState(false);

  const catalogActive = pathname === base || pathname === `${base}/`;

  return (
    <div dir={dir} className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link href={base} className="font-semibold text-primary tracking-wide shrink-0">
            Celestia Shop
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link
              href={base}
              className={cn(
                catalogActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("nav.catalog")}
            </Link>
            <LanguageSwitcher />
          </nav>
          <div className="flex sm:hidden items-center gap-1">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="菜单"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="sm:hidden border-t border-border/60 px-4 py-3">
            <Link
              href={base}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block py-2 text-sm",
                catalogActive ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {t("nav.catalog")}
            </Link>
          </nav>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function ShopProductCard({
  href,
  title,
  imageUrl,
  minPrice,
  maxPrice,
  hasOnSale,
  fromLabel,
}: {
  href: string;
  title: string;
  imageUrl: string | null;
  minPrice: string;
  maxPrice: string;
  hasOnSale: boolean;
  fromLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border/60 overflow-hidden bg-card/30 hover:border-primary/40 transition-colors"
    >
      <div className="aspect-square relative bg-muted/30">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
        {hasOnSale && (
          <span className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
            SALE
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium line-clamp-2 mb-2">{title}</h3>
        <p className="text-sm font-semibold text-primary">
          {minPrice !== maxPrice ? `${fromLabel} ${minPrice}` : minPrice} SAR
        </p>
      </div>
    </Link>
  );
}
