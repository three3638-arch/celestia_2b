"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AuthCard } from "@/components/auth/auth-card";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";

const adminLoginSchema = z.object({
  phone: z.string().min(5, "请输入手机号").max(20),
  password: z.string().min(6, "密码至少6位"),
});

type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

interface LoginResponse {
  success: boolean;
  data?: {
    id: string;
    phone: string;
    name: string;
    role: string;
    status: "ACTIVE" | "PENDING";
  };
  error?: string;
  message?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  
  const [apiError, setApiError] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminLoginFormData>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: AdminLoginFormData) => {
    setApiError("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      const result: LoginResponse = await response.json();
      
      if (!result.success) {
        setApiError(result.error || "登录失败");
        return;
      }
      
      // 检查是否是管理员
      if (result.data?.role !== "ADMIN") {
        setApiError("您没有管理员权限");
        return;
      }
      
      // 登录成功，跳转到管理后台
      router.push("/admin");
    } catch {
      setApiError("网络错误，请重试");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <AuthCard title="Celestia 管理后台" subtitle="管理员登录">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Phone Field */}
          <FormGroup
            label="手机号"
            htmlFor="phone"
            error={errors.phone?.message}
            required
          >
            <Input
              id="phone"
              type="tel"
              placeholder="请输入手机号"
              {...register("phone")}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 h-12"
            />
          </FormGroup>

          {/* Password Field */}
          <FormGroup
            label="密码"
            htmlFor="password"
            error={errors.password?.message}
            required
          >
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              {...register("password")}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 h-12"
            />
          </FormGroup>

          {/* API Error */}
          <ErrorAlert message={apiError} />

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-primary hover:bg-accent text-primary-foreground font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <LoadingSpinner className="w-5 h-5" />
            ) : (
              "登录"
            )}
          </Button>
        </form>
      </AuthCard>

      {/* Footer */}
      <p className="text-muted-foreground/60 text-xs text-center mt-8">
        Celestia Jewelry Management System
      </p>
    </div>
  );
}
