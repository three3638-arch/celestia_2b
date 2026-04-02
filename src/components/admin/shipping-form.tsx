"use client";

import { useState, useEffect } from "react";
import { Truck, Loader2, X } from "lucide-react";

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
import { addShipping, updateShipping } from "@/lib/actions/shipping";

interface ShippingFormProps {
  orderId: string;
  shipping?: {
    id: string;
    trackingNo: string | null;
    trackingUrl: string | null;
    method: string | null;
    note: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ShippingForm({
  orderId,
  shipping,
  open,
  onOpenChange,
  onSuccess,
}: ShippingFormProps) {
  const [trackingNo, setTrackingNo] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [shippingCostCny, setShippingCostCny] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initialize form when shipping data changes
  useEffect(() => {
    if (shipping) {
      setTrackingNo(shipping.trackingNo || "");
      setTrackingUrl(shipping.trackingUrl || "");
      setMethod(shipping.method || "");
      setNote(shipping.note || "");
    } else {
      setTrackingNo("");
      setTrackingUrl("");
      setMethod("");
      setNote("");
      setShippingCostCny("");
    }
    setError("");
  }, [shipping, open]);

  const handleSubmit = async () => {
    // Validate
    if (!trackingNo.trim()) {
      setError("请输入物流单号");
      return;
    }
    if (!method.trim()) {
      setError("请输入物流方式");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const data = {
        trackingNo: trackingNo.trim(),
        trackingUrl: trackingUrl.trim() || undefined,
        method: method.trim(),
        note: note.trim() || undefined,
        shippingCostCny: shippingCostCny ? parseFloat(shippingCostCny) : undefined,
      };

      let result;
      if (shipping) {
        // Update existing shipping
        result = await updateShipping(shipping.id, data);
      } else {
        // Add new shipping
        result = await addShipping(orderId, data);
      }

      if (result.success) {
        onOpenChange(false);
        onSuccess();
      } else {
        setError(result.error || "保存物流信息失败");
      }
    } catch (err) {
      setError("保存物流信息失败，请重试");
      console.error("Shipping error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError("");
    }
    onOpenChange(open);
  };

  const isEditing = !!shipping;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {isEditing ? "编辑物流信息" : "录入物流信息"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEditing
              ? "更新订单的物流跟踪信息"
              : "填写订单的发货物流信息，客户将能查看跟踪链接"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* 物流单号 */}
          <div className="space-y-2">
            <Label htmlFor="trackingNo" className="text-foreground">
              物流单号 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="trackingNo"
              placeholder="请输入物流单号"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* 物流方式 */}
          <div className="space-y-2">
            <Label htmlFor="method" className="text-foreground">
              物流方式 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="method"
              placeholder="例如：DHL、FedEx、顺丰"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* 跟踪链接 */}
          <div className="space-y-2">
            <Label htmlFor="trackingUrl" className="text-foreground">
              跟踪链接
            </Label>
            <Input
              id="trackingUrl"
              type="url"
              placeholder="https://..."
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* 运费 */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="shippingCost" className="text-foreground">
                运费 (CNY)
              </Label>
              <div className="relative">
                <Input
                  id="shippingCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={shippingCostCny}
                  onChange={(e) => setShippingCostCny(e.target.value)}
                  className="bg-background border-border pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  CNY
                </span>
              </div>
            </div>
          )}

          {/* 备注 */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-foreground">
              备注
            </Label>
            <Textarea
              id="note"
              placeholder="可选：填写物流相关备注信息"
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
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              isEditing ? "保存修改" : "确认录入"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
