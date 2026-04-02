"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AuthCard } from "@/components/auth/auth-card";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useTranslations } from "next-intl";

const loginFormSchema = z.object({
  phone: z.string().min(5, "Phone number is required").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

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

export default function LoginPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("auth");
    const tCommon = useTranslations("common");
  
  const [apiError, setApiError] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
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
        setApiError(result.error || t("loginFailed"));
        return;
      }
      
      if (result.data?.status === "ACTIVE") {
        router.push(`/${locale}/storefront`);
      } else if (result.data?.status === "PENDING") {
        router.push(`/${locale}/storefront/pending`);
      }
    } catch {
      setApiError(tCommon("networkError"));
    }
  };

  return (
    <AuthCard title={t("login")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Phone Field */}
        <FormGroup
          label={t("phone")}
          htmlFor="phone"
          error={errors.phone?.message}
          required
        >
          <Input
            id="phone"
            type="tel"
            placeholder={t("phone")}
            {...register("phone")}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 h-12"
          />
        </FormGroup>

        {/* Password Field */}
        <FormGroup
          label={t("password")}
          htmlFor="password"
          error={errors.password?.message}
          required
        >
          <Input
            id="password"
            type="password"
            placeholder={t("password")}
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
            t("login")
          )}
        </Button>
      </form>

      {/* Register Link */}
      <div className="mt-6 text-center">
        <p className="text-muted-foreground text-sm">
          {t("noAccount")}{" "}
          <Link
            href={`/${locale}/storefront/register`}
            className="text-primary hover:text-primary/80 transition-colors font-medium"
          >
            {t("register")}
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
