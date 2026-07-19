"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  MessageSquare,
  LogOut,
  Mail,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/shop-admin", icon: LayoutDashboard, label: "仪表盘", adminOnly: false },
  { href: "/shop-admin/products", icon: Package, label: "商品管理", adminOnly: false },
  { href: "/shop-admin/categories", icon: FolderOpen, label: "品类管理", adminOnly: true },
  { href: "/shop-admin/inquiries", icon: MessageSquare, label: "询价管理", adminOnly: false },
  { href: "/shop-admin/contacts", icon: Mail, label: "官网留言", adminOnly: true },
] as const;

function NavLinks({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  const items = navItems.filter((item) => isAdmin || !item.adminOnly);

  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function ShopAdminLayout({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/shop-auth/logout", { method: "POST" });
    router.push("/shop-admin/login");
  };

  return (
    <div className="flex h-screen bg-background flex-col lg:flex-row">
      <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Celestia" width={24} height={24} />
          <span className="font-semibold text-primary text-sm">2C 管理后台</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)} aria-label="菜单">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </header>

      {mobileOpen && (
        <nav className="lg:hidden border-b border-border p-3 space-y-1 bg-background">
          <NavLinks pathname={pathname} isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} />
          <Button variant="ghost" className="w-full justify-start gap-2 mt-2" onClick={logout}>
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        </nav>
      )}

      <aside className="hidden lg:flex flex-col w-60 border-r border-border shrink-0">
        <div className="flex items-center gap-2 h-16 px-4 border-b border-border">
          <Image src="/logo.png" alt="Celestia" width={28} height={28} />
          <span className="font-semibold text-primary">2C 管理后台</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks pathname={pathname} isAdmin={isAdmin} />
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
