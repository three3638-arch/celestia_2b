"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Clock, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default function PendingPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("pending");
  const tAuth = useTranslations("auth");
  
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    setIsSigningOut(true);
    // 直接导航到 GET 登出端点，服务端同时清除 cookie 并重定向到登录页
    window.location.href = `/api/auth/logout?locale=${locale}`;
  };

  return (
    <Card className="border-border">
      <CardContent className="p-8 md:p-10 text-center">
        {/* Icon Container */}
        <div className="relative flex justify-center mb-6">
          {/* Decorative glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-primary/20 rounded-full blur-xl" />
          </div>

          {/* Main icon */}
          <div className="relative w-20 h-20 bg-gradient-to-br from-primary to-muted-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/20">
            <Clock className="w-10 h-10 text-primary-foreground" />
          </div>

          {/* Sparkle decorations */}
          <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-primary" />
          <CheckCircle className="absolute -bottom-1 -left-1 w-5 h-5 text-accent" />
        </div>

        {/* Title */}
        <h2 className="text-foreground text-2xl font-semibold mb-4">
          {t("title")}
        </h2>

        {/* Description */}
        <div className="space-y-4 mb-8">
          <p className="text-muted-foreground text-base leading-relaxed">
            {t("description")}
          </p>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
            <p className="text-primary text-sm">
              {t("patience")}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <Button
          onClick={handleSignOut}
          disabled={isSigningOut}
          variant="outline"
          className="w-full h-12 border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSigningOut ? (
            <LoadingSpinner className="w-5 h-5" />
          ) : (
            tAuth("signOut")
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
