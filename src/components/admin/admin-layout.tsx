"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const sidebarItems = [
  { href: "/admin", icon: LayoutDashboard, label: "仪表盘" },
  { href: "/admin/products", icon: Package, label: "商品管理" },
  { href: "/admin/orders", icon: ShoppingBag, label: "订单管理" },
  { href: "/admin/customers", icon: Users, label: "客户管理" },
];

const pageTitles: Record<string, string> = {
  "/admin": "仪表盘",
  "/admin/products": "商品管理",
  "/admin/orders": "订单管理",
  "/admin/customers": "客户管理",
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  const pageTitle = pageTitles[pathname] || "管理后台";

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-background border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-border">
          <Image
            src="/logo.png"
            alt="Celestia"
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
          />
          <span className="text-primary font-semibold tracking-wide">
            管理后台
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => window.location.href = "/"}
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar with Sheet */}
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden fixed top-3 left-3 z-40 text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b border-border">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Celestia"
                width={28}
                height={28}
                className="w-7 h-7 object-contain"
              />
              <SheetTitle className="text-primary font-semibold tracking-wide">
                管理后台
              </SheetTitle>
            </div>
          </SheetHeader>

          {/* Navigation */}
          <nav className="py-4 px-3 space-y-1">
            {sidebarItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => window.location.href = "/"}
            >
              <LogOut className="w-5 h-5" />
              退出登录
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="flex items-center justify-between h-16 px-4 lg:px-6 bg-background border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-8 lg:hidden" /> {/* Spacer for menu button */}
            <h1 className="text-lg font-medium text-foreground">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              管理员
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm text-primary">A</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
