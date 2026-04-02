"use client";

import { useState, useRef, useCallback } from "react";
import { DollarSign, Upload, X, Loader2, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPayment } from "@/lib/actions/payment";

interface PaymentFormProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const paymentMethods = [
  { value: "BANK_TRANSFER", label: "银行转账" },
  { value: "WESTERN_UNION", label: "西联汇款" },
  { value: "CASH", label: "现金" },
  { value: "OTHER", label: "其他" },
];

export function PaymentForm({ orderId, open, onOpenChange, onSuccess }: PaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 上传凭证图片
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("图片大小不能超过 10MB");
      return;
    }

    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("上传失败");
      }

      const data = await response.json();
      setProofUrl(data.url);
    } catch (err) {
      setError("凭证上传失败，请重试");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  }, []);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 删除已上传凭证
  const handleRemoveProof = () => {
    setProofUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 提交付款
  const handleSubmit = async () => {
    // 验证
    if (!amount || parseFloat(amount) === 0) {
      setError("请输入有效的付款金额（不能为零）");
      return;
    }

    if (!method) {
      setError("请选择付款方式");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await addPayment(orderId, {
        amountSar: amount,
        method,
        proofUrl: proofUrl || undefined,
        note: note || undefined,
      });

      if (result.success) {
        // 重置表单
        setAmount("");
        setMethod("BANK_TRANSFER");
        setNote("");
        setProofUrl(null);
        onOpenChange(false);
        onSuccess();
      } else {
        setError(result.error || "录入付款失败");
      }
    } catch (err) {
      setError("录入付款失败，请重试");
      console.error("Payment error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // 关闭时重置
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setAmount("");
      setMethod("BANK_TRANSFER");
      setNote("");
      setProofUrl(null);
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            录入付款
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            记录客户的付款信息，上传付款凭证
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* 金额 */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-foreground">
              付款金额 (SAR) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-background border-border pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                SAR
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              正数为收款，负数为退款
            </p>
          </div>

          {/* 付款方式 */}
          <div className="space-y-2">
            <Label htmlFor="method" className="text-foreground">
              付款方式 <span className="text-destructive">*</span>
            </Label>
            <Select value={method} onValueChange={(value) => setMethod(value || "BANK_TRANSFER")}>
              <SelectTrigger id="method" className="bg-background border-border">
                <SelectValue placeholder="选择付款方式" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 凭证上传 */}
          <div className="space-y-2">
            <Label className="text-foreground">付款凭证</Label>
            {proofUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={proofUrl}
                  alt="付款凭证"
                  className="w-full h-40 object-contain bg-muted"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemoveProof}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-card transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">上传中...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-foreground font-medium">点击上传凭证</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 JPG、PNG 格式</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </div>
            )}
          </div>

          {/* 备注 */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-foreground">
              备注
            </Label>
            <Textarea
              id="note"
              placeholder="可选：填写付款相关备注信息"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-background border-border min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={submitting || uploading}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              "确认录入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
