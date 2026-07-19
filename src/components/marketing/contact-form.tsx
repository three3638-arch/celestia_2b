"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { submitContactForm } from "@/lib/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";
import { HONEYPOT_FIELD } from "@/lib/honeypot";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function ContactForm() {
  const t = useTranslations("marketing.contact");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (turnstileEnabled && !turnstileToken) {
      setError(t("captchaRequired"));
      setLoading(false);
      return;
    }
    const result = await submitContactForm({
      name,
      email,
      phone,
      message,
      locale,
      [HONEYPOT_FIELD]: honeypot,
      turnstileToken: turnstileToken || undefined,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error || t("formError"));
      return;
    }
    setSuccess(true);
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  };

  if (success) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center">
        <p className="text-primary font-medium">{t("formSuccess")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 relative">
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
      <FormGroup label={t("formName")} htmlFor="contact-name" required>
        <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </FormGroup>
      <FormGroup label={t("formEmail")} htmlFor="contact-email" required>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormGroup>
      <FormGroup label={t("formPhone")} htmlFor="contact-phone">
        <Input id="contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </FormGroup>
      <FormGroup label={t("formMessage")} htmlFor="contact-message" required>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </FormGroup>
      <TurnstileWidget onToken={setTurnstileToken} />
      <ErrorAlert message={error} />
      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? "..." : t("formSubmit")}
      </Button>
    </form>
  );
}
