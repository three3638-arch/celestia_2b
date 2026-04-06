"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { User, Phone, Building2, LogOut, Check, Globe, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface UserInfo {
  name: string;
  phone: string;
  company: string | null;
}

const languages = [
  { code: "en", label: "English", labelKey: "english", flag: "🇺🇸" },
  { code: "ar", label: "العربية", labelKey: "arabic", flag: "🇸🇦" },
  { code: "zh", label: "中文", labelKey: "chinese", flag: "🇨🇳" },
] as const;

export default function ProfilePage() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("profile");
  const tAuth = useTranslations("auth");
  const tHidden = useTranslations("hidden");
  
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 获取用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data.data?.user);
        }
      } catch {
        // 静默处理错误
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  // 处理语言切换
  const handleLanguageChange = (newLocale: string) => {
    if (newLocale === locale) return;
    
    // 替换 URL 中的 locale 前缀
    const newPathname = pathname.replace(/^\/(en|ar|zh)/, `/${newLocale}`);
    window.location.href = newPathname;
  };

  // 处理退出登录
  const handleLogout = () => {
    setIsLoggingOut(true);
    // 直接导航到 GET 登出端点，服务端同时清除 cookie 并重定向到登录页
    window.location.href = `/api/auth/logout?locale=${locale}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4">
          <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* 用户信息卡片 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t("userInfo")}
          </h2>
          <Card className="p-4 bg-card border-border">
            <div className="space-y-4">
              {/* 姓名 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("name")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {userInfo?.name || "-"}
                  </p>
                </div>
              </div>

              {/* 手机号 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("phone")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {userInfo?.phone || "-"}
                  </p>
                </div>
              </div>

              {/* 公司 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t("company")}</p>
                  <p className="text-sm font-medium text-foreground">
                    {userInfo?.company || "-"}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.section>

        {/* 隐藏商品入口 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link
            href={`/${locale}/storefront/hidden`}
            className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {tHidden("title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {tHidden("manageHidden")}
              </p>
            </div>
          </Link>
        </motion.section>

        {/* 语言切换区域 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t("language")}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {languages.map((lang) => {
              const isActive = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "relative flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 text-start",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {/* 国旗 */}
                  <span className="text-2xl">{lang.flag}</span>
                  
                  {/* 语言名称 */}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {t(lang.labelKey)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lang.label}
                    </p>
                  </div>

                  {/* 选中标记 */}
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* 退出登录按钮 */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Button
            variant="outline"
            className="w-full h-12 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" />
                {tAuth("signingOut")}
              </span>
            ) : (
              <>
                <LogOut className="w-5 h-5 me-2" />
                {tAuth("signOut")}
              </>
            )}
          </Button>
        </motion.section>
      </div>
    </div>
  );
}
