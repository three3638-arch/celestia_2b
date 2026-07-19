"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { shopCatalogUrl } from "@/lib/shop-routes";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "", key: "home" },
  { href: "/about", key: "about" },
  { href: "/services", key: "services" },
  { href: "/contact", key: "contact" },
] as const;

export function MarketingLayout({
  children,
  dir,
}: {
  children: React.ReactNode;
  dir: "ltr" | "rtl";
}) {
  const t = useTranslations("marketing");
  const locale = useLocale();
  const pathname = usePathname();

  const base = `/${locale}`;
  const shopLink = shopCatalogUrl(locale);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (active: boolean) =>
    cn(
      "block px-3 py-2 text-sm rounded-md transition-colors",
      active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href={base} className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="Celestia" width={32} height={32} className="w-8 h-8" />
            <span className="font-semibold text-primary tracking-wide">Celestia</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const href = item.href ? `${base}${item.href}` : base;
              const active =
                item.href === ""
                  ? pathname === base || pathname === `${base}/`
                  : pathname.startsWith(`${base}${item.href}`);
              return (
                <Link key={item.key} href={href} className={navLinkClass(active)}>
                  {t(`nav.${item.key}`)}
                </Link>
              );
            })}
            <a href={shopLink} className="px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors">
              {t("nav.shop")}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="菜单"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-border/60 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const href = item.href ? `${base}${item.href}` : base;
              const active =
                item.href === ""
                  ? pathname === base || pathname === `${base}/`
                  : pathname.startsWith(`${base}${item.href}`);
              return (
                <Link
                  key={item.key}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={navLinkClass(active)}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              );
            })}
            <a
              href={shopLink}
              className="block px-3 py-2 text-sm text-muted-foreground hover:text-primary"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.shop")}
            </a>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Celestia Jewelry. {t("footer.rights")}
        </div>
      </footer>
    </div>
  );
}
