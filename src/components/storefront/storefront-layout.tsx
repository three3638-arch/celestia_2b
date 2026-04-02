"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Grid3X3, ClipboardList, User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CartBadge } from "@/components/storefront/cart-badge";
import { LanguageSwitcher } from "@/components/storefront/language-switcher";
import { useTranslations } from "next-intl";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  dir?: "ltr" | "rtl";
  locale?: string;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  isCart?: boolean;
}

export function StorefrontLayout({ children, dir = "ltr", locale: propLocale }: StorefrontLayoutProps) {
  const pathname = usePathname();
  const locale = propLocale || pathname.split('/')[1] || 'en';
  const t = useTranslations("nav");

  const bottomNavItems: NavItem[] = [
    { href: `/${locale}/storefront`, icon: Home, label: t("home") },
    { href: `/${locale}/storefront/cart`, icon: Grid3X3, label: t("cart"), isCart: true },
    { href: `/${locale}/storefront/favorites`, icon: Heart, label: t("favorites") },
    { href: `/${locale}/storefront/orders`, icon: ClipboardList, label: t("orders") },
    { href: `/${locale}/storefront/profile`, icon: User, label: t("profile") },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href={`/${locale}/storefront`} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Celestia"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <span className="text-primary font-semibold text-lg tracking-wide">
              CELESTIA
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href={`/${locale}/storefront`}
              className="text-foreground hover:text-primary transition-colors text-sm"
            >
              {t("home")}
            </Link>
            <Link
              href={`/${locale}/storefront/favorites`}
              className="text-foreground hover:text-primary transition-colors text-sm"
            >
              {t("favorites")}
            </Link>
            <Link
              href={`/${locale}/storefront/orders`}
              className="text-foreground hover:text-primary transition-colors text-sm"
            >
              {t("orders")}
            </Link>
            <Link
              href={`/${locale}/storefront/cart`}
              className="text-foreground hover:text-primary transition-colors text-sm"
            >
              {t("cart")}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex-1 overflow-y-auto pb-16 md:pb-0"
      >
        {children}
      </motion.main>

      {/* Mobile Bottom Navigation */}
      <TooltipProvider>
        <nav className="fixed bottom-0 start-0 end-0 z-50 bg-background border-t border-border md:hidden">
          <div className="flex items-center justify-around h-14">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              
              // 购物车使用 CartBadge 组件
              if (item.isCart) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger
                      render={
                        <div className={cn(
                          "flex flex-col items-center justify-center flex-1 h-full",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}>
                          <CartBadge locale={locale} />
                        </div>
                      }
                    />
                    <TooltipContent side="top">
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }
              
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.href}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="text-[10px]">{item.label}</span>
                      </Link>
                    }
                  />
                  <TooltipContent side="top">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </nav>
      </TooltipProvider>
    </div>
  );
}
