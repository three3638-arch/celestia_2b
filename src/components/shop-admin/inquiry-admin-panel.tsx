"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShopInquiryStatus } from "@/lib/actions/shop-inquiry";
import { Button } from "@/components/ui/button";
import type { ShopInquiryStatus } from "@prisma/client";

const STATUS_LABELS: Record<ShopInquiryStatus, string> = {
  NEW: "新询价",
  CONTACTED: "已联系",
  CONVERTED: "已转化",
  CLOSED: "已关闭",
};

const ACTION_STATUSES: ShopInquiryStatus[] = ["CONTACTED", "CONVERTED", "CLOSED"];

export function InquiryAdminPanel({
  id,
  currentStatus,
  adminNote: initialNote,
}: {
  id: string;
  currentStatus: ShopInquiryStatus;
  adminNote: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote || "");
  const [loading, setLoading] = useState(false);

  const update = async (status: ShopInquiryStatus) => {
    setLoading(true);
    await updateShopInquiryStatus(id, status, note.trim() || undefined);
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-3 border-t border-border pt-3 mt-3">
      <p className="text-xs text-muted-foreground">
        当前状态：<span className="font-medium text-foreground">{STATUS_LABELS[currentStatus]}</span>
      </p>
      <label className="block text-sm">
        <span className="text-muted-foreground">内部备注</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full min-h-[72px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="跟进记录、客户偏好等（仅后台可见）"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {ACTION_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={currentStatus === status ? "default" : "outline"}
            disabled={loading}
            onClick={() => update(status)}
          >
            标为{STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function inquiryStatusLabel(status: ShopInquiryStatus): string {
  return STATUS_LABELS[status];
}
