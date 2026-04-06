"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

const registerFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(5, "Phone number is required").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
  company: z.string().max(200).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

interface RegisterResponse {
  success: boolean;
  data?: {
    id: string;
    phone: string;
    name: string;
    role: string;
  };
  error?: string;
  message?: string;
}

export default function RegisterPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const t = useTranslations("auth");
    const tCommon = useTranslations("common");
  
  const [apiError, setApiError] = useState<string>("");
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      confirmPassword: "",
      company: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setApiError("");
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          password: data.password,
          company: data.company,
        }),
      });
      
      const result: RegisterResponse = await response.json();
      
      if (!result.success) {
        setApiError(result.error || t("registrationFailed"));
        return;
      }
      
      // 注册成功后跳转到待审核页面
      window.location.href = `/${locale}/storefront/pending`;
    } catch {
      setApiError(tCommon("networkError"));
    }
  };

  return (
    <AuthCard title={t("register")}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Name Field */}
        <FormGroup
          label={t("name")}
          htmlFor="name"
          error={errors.name?.message}
          required
        >
          <Input
            id="name"
            type="text"
            placeholder={t("name")}
            {...register("name")}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 h-12"
          />
        </FormGroup>

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

        {/* Confirm Password Field */}
        <FormGroup
          label={t("confirmPassword")}
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
          required
        >
          <Input
            id="confirmPassword"
            type="password"
            placeholder={t("confirmPassword")}
            {...register("confirmPassword")}
            className="bg-background border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary/20 h-12"
          />
        </FormGroup>

        {/* Company Field (Optional) */}
        <FormGroup
          label={t("company")}
          htmlFor="company"
          error={errors.company?.message}
        >
          <Input
            id="company"
            type="text"
            placeholder={t("company")}
            {...register("company")}
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
            t("register")
          )}
        </Button>
      </form>

      {/* Login Link */}
      <div className="mt-6 text-center">
        <p className="text-muted-foreground text-sm">
          {t("hasAccount")}{" "}
          <Link
            href={`/${locale}/storefront/login`}
            className="text-primary hover:text-primary/80 transition-colors font-medium"
          >
            {t("login")}
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
