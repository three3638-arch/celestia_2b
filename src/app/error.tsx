"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-medium text-foreground">
            出错了
          </h1>
          <p className="text-sm text-muted-foreground">
            抱歉，应用程序遇到了问题。请尝试刷新页面或返回首页。
          </p>
        </div>

        {error.message && process.env.NODE_ENV === "development" && (
          <div className="bg-card border border-border rounded-lg p-4 text-left">
            <p className="text-xs text-destructive font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-primary text-primary-foreground hover:bg-accent"
          >
            重试
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="border-border text-foreground hover:bg-card"
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
