"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitShopInquiry } from "@/lib/actions/shop-inquiry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function InquiryForm() {
  const t = useTranslations("shop.inquiry");
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("productId") || "";
  const variantId = searchParams.get("variantId") || "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (turnstileEnabled && !turnstileToken) {
      setError(t("captchaRequired"));
      setLoading(false);
      return;
    }
    const result = await submitShopInquiry({
      productId,
      variantId: variantId || undefined,
      name,
      phone,
      email,
      message,
      [HONEYPOT_FIELD]: honeypot,
      turnstileToken: turnstileToken || undefined,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error || t("error"));
      return;
    }
    router.push(`?success=1&productId=${productId}`);
  };

  if (!productId) {
    return <p className="text-muted-foreground">{t("invalidProduct")}</p>;
  }

  if (searchParams.get("success") === "1") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
        <p className="text-primary font-medium">{t("success")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md relative">
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
        name={HONEYPOT_FIELD}
      />
      <FormGroup label={t("name")} htmlFor="name" required>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </FormGroup>
      <FormGroup label={t("phone")} htmlFor="phone" required>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </FormGroup>
      <FormGroup label={t("email")} htmlFor="email">
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </FormGroup>
      <FormGroup label={t("message")} htmlFor="message">
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </FormGroup>
      <TurnstileWidget onToken={setTurnstileToken} />
      <ErrorAlert message={error} />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "..." : t("submit")}
      </Button>
    </form>
  );
}
