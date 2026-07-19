"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";

export default function ShopAdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/shop-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!data.success) {
      setError(data.error || "登录失败");
      return;
    }
    router.push("/shop-admin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <AuthCard title="Celestia 2C 管理后台" subtitle="运营人员登录">
        <form onSubmit={onSubmit} className="space-y-4">
          <FormGroup label="手机号" htmlFor="phone" required>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </FormGroup>
          <FormGroup label="密码" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormGroup>
          <ErrorAlert message={error} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
      </AuthCard>
    </div>
  );
}
