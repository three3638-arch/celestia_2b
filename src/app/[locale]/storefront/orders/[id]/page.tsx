"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Truck,
  CreditCard,
  Check,
  AlertCircle,
  X,
  Plus,
  ExternalLink,
  Trash2,
  Minus,
} from "lucide-react";
import { getOrderDetail, confirmOrder, cancelOrder, customerUpdateOrder } from "@/lib/actions/order";
import { getCustomerSettlementSummary, type CustomerSettlementSummary } from "@/lib/actions/settlement";
import { formatPrice, formatDate } from "@/lib/utils";
import { ORDER_STATUS_CONFIG, ORDER_ITEM_STATUS_CONFIG } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";

interface OrderDetailPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

// Order status flow for progress bar
const STATUS_FLOW = [
  "PENDING_QUOTE",
  "QUOTED",
  "CONFIRMED",
  "FULLY_PAID",
  "SHIPPED",
  "COMPLETED",
] as const;

interface OrderItem {
  id: string;
  skuId: string;
  productNameSnapshot: string;
  skuDescSnapshot: string;
  quantity: number;
  unitPriceCny: string | null;
  unitPriceSar: string | null;
  itemStatus: string;
  productImage: string | null;
}

interface Payment {
  id: string;
  amountSar: string;
  method: string;
  proofUrl: string | null;
  note: string | null;
  confirmedAt: Date;
}

interface Shipping {
  id: string;
  trackingNo: string | null;
  trackingUrl: string | null;
  method: string | null;
  note: string | null;
}

interface OrderDetail {
  id: string;
  orderNo: string;
  status: string;
  statusLabel: string;
  exchangeRate: string | null;
  markupRatio: string | null;
  totalCny: string | null;
  totalSar: string | null;
  overrideTotalSar: string | null;
  shippingCostCny: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  items: OrderItem[];
  payments: Payment[];
  shipping: Shipping | null;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const router = useRouter();
  const t = useTranslations("orders");
  const tCommon = useTranslations("common");
  const currentLocale = useLocale();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [settlement, setSettlement] = useState<CustomerSettlementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<OrderItem | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>("en");

  // Get locale from params
  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  const fetchOrderDetail = useCallback(async () => {
    try {
      const resolvedParams = await params;
      const result = await getOrderDetail(resolvedParams.id);
      if (result.success && result.data) {
        setOrder(result.data);
        
        // 如果订单在 SETTLING 或 COMPLETED 状态，获取结算数据
        if (["SETTLING", "COMPLETED"].includes(result.data.status)) {
          const settlementResult = await getCustomerSettlementSummary(resolvedParams.id);
          if (settlementResult.success && settlementResult.data) {
            setSettlement(settlementResult.data);
          }
        }
      } else {
        toast.error(result.error || t("fetchFailed"));
      }
    } catch {
      toast.error(t("fetchFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleConfirmOrder = async () => {
    if (!order) return;
    
    setIsConfirming(true);
    try {
      const resolvedParams = await params;
      const result = await confirmOrder(resolvedParams.id);
      if (result.success) {
        toast.success(t("confirmSuccess"));
        setShowConfirmDialog(false);
        fetchOrderDetail();
      } else {
        toast.error(result.error || t("confirmFailed"));
      }
    } catch {
      toast.error(t("confirmFailed"));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    setIsCancelling(true);
    try {
      const resolvedParams = await params;
      const result = await cancelOrder(resolvedParams.id);
      if (result.success) {
        toast.success(t("cancelSuccess"));
        setShowCancelDialog(false);
        fetchOrderDetail();
      } else {
        toast.error(result.error || t("cancelFailed"));
      }
    } catch {
      toast.error(t("cancelFailed"));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (!order || newQuantity < 1) return;
    
    setUpdatingItemId(itemId);
    try {
      const result = await customerUpdateOrder(order.id, {
        updateItems: [{ orderItemId: itemId, quantity: newQuantity }],
      });
      if (result.success) {
        toast.success(t("quantityUpdated"));
        fetchOrderDetail();
      } else {
        toast.error(result.error || t("updateFailed"));
      }
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleDeleteItem = async () => {
    if (!order || !itemToDelete) return;
    
    // 检查是否只剩一个商品
    const activeItems = order.items.filter(
      (item) => item.itemStatus !== "CUSTOMER_REMOVED"
    );
    if (activeItems.length <= 1) {
      toast.error(t("cannotDeleteLastItem"));
      setShowDeleteDialog(false);
      setItemToDelete(null);
      return;
    }
    
    setDeletingItemId(itemToDelete.id);
    try {
      const result = await customerUpdateOrder(order.id, {
        removeItemIds: [itemToDelete.id],
      });
      if (result.success) {
        toast.success(t("itemDeleted"));
        setShowDeleteDialog(false);
        setItemToDelete(null);
        fetchOrderDetail();
      } else {
        toast.error(result.error || t("deleteFailed"));
      }
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setDeletingItemId(null);
    }
  };

  const openDeleteDialog = (item: OrderItem) => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  };

  const canModifyItems = (status: string) => {
    return ["PENDING_QUOTE", "QUOTED", "NEGOTIATING"].includes(status);
  };

  const getStatusIndex = (status: string) => {
    return STATUS_FLOW.indexOf(status as typeof STATUS_FLOW[number]);
  };

  const getCurrentStatusIndex = () => {
    if (!order) return -1;
    if (order.status === "CANCELLED") return -1;
    if (order.status === "NEGOTIATING") return getStatusIndex("PENDING_QUOTE");
    if (order.status === "PARTIALLY_PAID") return getStatusIndex("CONFIRMED");
    return getStatusIndex(order.status);
  };

  // 获取订单状态标签（根据当前 locale）
  const getStatusLabel = (status: string): string => {
    const statusKey = status.toLowerCase() === "pending_quote" ? "pendingQuote" :
                      status.toLowerCase() === "fully_paid" ? "fullyPaid" :
                      status.toLowerCase() === "partially_paid" ? "partiallyPaid" :
                      status.toLowerCase();
    try {
      return t(statusKey);
    } catch {
      return ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]?.label_en || status;
    }
  };

  const getItemStatusBadge = (itemStatus: string) => {
    const config = ORDER_ITEM_STATUS_CONFIG[itemStatus as keyof typeof ORDER_ITEM_STATUS_CONFIG];
    if (!config) return null;
    
    // 使用翻译或 fallback 到英文标签
    const label = itemStatus === "OUT_OF_STOCK" ? t("outOfStock") :
                  itemStatus === "CUSTOMER_REMOVED" ? t("removed") :
                  config.label_en;

    switch (itemStatus) {
      case "OUT_OF_STOCK":
        return (
          <Badge variant="destructive" className="text-[10px]">
            {label}
          </Badge>
        );
      case "CUSTOMER_REMOVED":
        return (
          <Badge variant="secondary" className="text-[10px] line-through">
            {label}
          </Badge>
        );
      default:
        return null;
    }
  };

  const getSubtotal = (item: OrderItem) => {
    if (!item.unitPriceSar) return null;
    const price = parseFloat(item.unitPriceSar);
    return price * item.quantity;
  };

  const renderActionButtons = () => {
    if (!order) return null;

    const { status, id } = order;

    // CANCELLED state
    if (status === "CANCELLED") {
      return (
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-center gap-2 text-destructive">
            <X className="w-5 h-5" />
            <span className="font-medium">{t("orderCancelled")}</span>
          </div>
        </div>
      );
    }

    // PENDING_QUOTE / NEGOTIATING
    if (status === "PENDING_QUOTE" || status === "NEGOTIATING") {
      return (
        <div className="flex gap-3">
          <Link href={`/${locale}/storefront/orders/${id}/add-items`} className="flex-1">
            <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10">
              <Plus className="w-4 h-4 me-2" />
              {t("addItems")}
            </Button>
          </Link>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => setShowCancelDialog(true)}
          >
            <X className="w-4 h-4 me-2" />
            {t("cancelOrder")}
          </Button>
        </div>
      );
    }

    // QUOTED
    if (status === "QUOTED") {
      return (
        <div className="space-y-3">
          <Button
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            onClick={() => setShowConfirmDialog(true)}
          >
            <Check className="w-5 h-5 me-2" />
            {t("confirmOrder")}
          </Button>
          <div className="flex gap-3">
            <Link href={`/${locale}/storefront/orders/${id}/add-items`} className="flex-1">
              <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4 me-2" />
                {t("addItems")}
              </Button>
            </Link>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => setShowCancelDialog(true)}
            >
              <X className="w-4 h-4 me-2" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      );
    }

    // CONFIRMED / PARTIALLY_PAID / FULLY_PAID
    if (["CONFIRMED", "PARTIALLY_PAID", "FULLY_PAID"].includes(status)) {
      return (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="w-5 h-5" />
            <span>{t("paymentRecordsShown")}</span>
          </div>
        </div>
      );
    }

    // SHIPPED
    if (status === "SHIPPED") {
      return (
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="w-5 h-5" />
            <span>{t("orderShipped")}</span>
          </div>
        </div>
      );
    }

    // COMPLETED
    if (status === "COMPLETED") {
      return (
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 text-primary">
            <Check className="w-5 h-5" />
            <span className="font-medium">{t("orderCompleted")}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground">{t("orderNotFound")}</h2>
        <Link href={`/${locale}/storefront/orders`}>
          <Button variant="link" className="mt-2">
            {t("backToOrders")}
          </Button>
        </Link>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();
  const activeItems = order.items.filter(
    (item) => item.itemStatus !== "CUSTOMER_REMOVED"
  );

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ms-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {t("orderNo")}{order.orderNo}
            </h1>
          </div>
          <Badge variant={order.status === "CANCELLED" ? "destructive" : "default"}>
            {order.statusLabel}
          </Badge>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Status Progress Bar */}
        {order.status !== "CANCELLED" && (
          <Card className="p-4 bg-card border-border">
            <div className="relative">
              <div className="flex justify-between items-center">
                {STATUS_FLOW.map((status, index) => {
                  const isCompleted = index < currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  const isPending = index > currentStatusIndex;

                  return (
                    <div key={status} className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                            ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={`text-[10px] mt-1 text-center max-w-[60px] ${
                          isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Progress Line */}
              <div className="absolute top-4 start-0 end-0 h-0.5 bg-muted -z-10 mx-4 rtl-progress-bar">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{
                    width: `${
                      currentStatusIndex >= 0
                        ? (currentStatusIndex / (STATUS_FLOW.length - 1)) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Items List */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t("itemsTitle")}
          </h2>
          <div className="space-y-3">
            {activeItems.map((item) => {
              // 查找对应的结算数据
              const settlementItem = settlement?.items.find(
                (si) => si.productNameSnapshot === item.productNameSnapshot && 
                        si.skuDescSnapshot === item.skuDescSnapshot
              );
              const hasSettlement = !!settlementItem;
              const isReturned = settlementItem?.isReturned || item.itemStatus === "RETURNED";
              const qtyChanged = settlementItem && settlementItem.settlementQty !== item.quantity;

              return (
                <Card
                  key={item.id}
                  className={`p-3 bg-card border-border ${
                    item.itemStatus === "CUSTOMER_REMOVED" || isReturned ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt={item.productNameSnapshot}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={`text-sm font-medium text-foreground truncate ${
                            item.itemStatus === "CUSTOMER_REMOVED" || isReturned ? "line-through" : ""
                          }`}
                        >
                          {item.productNameSnapshot}
                        </h3>
                        <div className="flex items-center gap-1">
                          {getItemStatusBadge(item.itemStatus)}
                          {isReturned && (
                            <Badge variant="destructive" className="text-[10px]">
                              {t("returned")}
                            </Badge>
                          )}
                          {/* 删除按钮 - 仅在可修改状态下显示 */}
                          {canModifyItems(order.status) && item.itemStatus !== "CUSTOMER_REMOVED" && (
                            <button
                              onClick={() => openDeleteDialog(item)}
                              disabled={deletingItemId === item.id}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                              title={t("deleteItem")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.skuDescSnapshot}
                      </p>
                      
                      {/* 价格和数量区域 */}
                      <div className="flex items-center justify-between mt-2">
                        {/* 数量显示/调整 */}
                        {canModifyItems(order.status) && item.itemStatus !== "CUSTOMER_REMOVED" ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1 || updatingItemId === item.id}
                              className="w-6 h-6 flex items-center justify-center rounded border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">
                              {updatingItemId === item.id ? (
                                <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={updatingItemId === item.id}
                              className="w-6 h-6 flex items-center justify-center rounded border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {hasSettlement ? (
                              <span>
                                {t("quantity")}: {qtyChanged ? (
                                  <>
                                    <span className="line-through">{item.quantity}</span>
                                    <span className="text-primary ms-1">→ {settlementItem.settlementQty}</span>
                                  </>
                                ) : (
                                  item.quantity
                                )}
                              </span>
                            ) : (
                              <span>{t("quantity")}: {item.quantity}</span>
                            )}
                          </div>
                        )}
                        
                        {/* 价格显示 */}
                        {hasSettlement ? (
                          <div className="text-end">
                            <span className="text-xs text-muted-foreground">
                              {formatPrice(settlementItem.settlementPriceSar)} × {settlementItem.settlementQty}
                            </span>
                            <p className="text-sm font-medium text-primary">
                              = {formatPrice(
                                parseFloat(settlementItem.settlementPriceSar) * settlementItem.settlementQty
                              )}
                            </p>
                            {parseFloat(settlementItem.difference) !== 0 && (
                              <p className={`text-[10px] ${
                                parseFloat(settlementItem.difference) > 0 ? "text-green-500" : "text-red-500"
                              }`}>
                                {parseFloat(settlementItem.difference) > 0 ? "+" : ""}
                                {formatPrice(settlementItem.difference)}
                              </p>
                            )}
                          </div>
                        ) : item.unitPriceSar ? (
                          <div className="text-end">
                            <span className="text-xs text-muted-foreground">
                              {formatPrice(item.unitPriceSar)} × {item.quantity}
                            </span>
                            <p className="text-sm font-medium text-primary">
                              = {formatPrice(getSubtotal(item) || 0)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            {t("pendingQuote")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Price Summary */}
        {(order.totalSar || settlement) && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t("summaryTitle")}
            </h2>
            <Card className="p-4 bg-card border-border">
              <div className="space-y-2">
                {settlement ? (
                  // 有结算数据时显示结算汇总
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("quotedAmount")}</span>
                      <span className="text-foreground line-through">{formatPrice(settlement.quoteTotalSar)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("settlementAmount")}</span>
                      <span className="text-foreground font-medium">{formatPrice(settlement.settlementTotalSar)}</span>
                    </div>
                    {parseFloat(settlement.differenceSar) !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {parseFloat(settlement.differenceSar) > 0 ? t("amountDue") : t("refundDue")}
                        </span>
                        <span className={`font-medium ${
                          parseFloat(settlement.differenceSar) > 0 ? "text-green-500" : "text-red-500"
                        }`}>
                          {formatPrice(Math.abs(parseFloat(settlement.differenceSar)))}
                        </span>
                      </div>
                    )}
                    {settlement.settlementNote && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{t("note")}:</span> {settlement.settlementNote}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  // 无结算数据时显示原始报价
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("subtotal")}</span>
                      <span className="text-foreground">{formatPrice(order.totalSar || "0")}</span>
                    </div>
                    {order.shippingCostCny && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("shippingCny")}</span>
                        <span className="text-foreground">¥{order.shippingCostCny}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-foreground">{t("total")}</span>
                        <span className="font-bold text-primary text-lg">
                          {formatPrice(order.overrideTotalSar || order.totalSar || "0")}
                        </span>
                      </div>
                      {order.overrideTotalSar && (
                        <p className="text-xs text-muted-foreground text-end mt-1">
                          {t("adjustedFrom")} {formatPrice(order.totalSar || "0")}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Action Buttons */}
        <section>{renderActionButtons()}</section>

        {/* Payment Records */}
        {order.payments.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t("paymentTitle")}
            </h2>
            <div className="space-y-2">
              {order.payments.map((payment, index) => (
                <Card key={payment.id} className="p-3 bg-card border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatPrice(payment.amountSar)}
                      </span>
                    </div>
                    <div className="text-end">
                      <span className="text-xs text-muted-foreground">
                        {payment.method}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.confirmedAt)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Shipping Info */}
        {order.shipping && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {t("shippingTitle")}
            </h2>
            <Card className="p-4 bg-card border-border">
              <div className="space-y-3">
                {order.shipping.trackingNo && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("trackingNo")}</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.shipping.trackingNo}
                    </span>
                  </div>
                )}
                {order.shipping.method && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{t("method")}</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.shipping.method}
                    </span>
                  </div>
                )}
                {order.shipping.trackingUrl && (
                  <a
                    href={order.shipping.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("trackShipment")}
                  </a>
                )}
                {order.shipping.note && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    {order.shipping.note}
                  </p>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Order Info */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t("orderInfoTitle")}
          </h2>
          <Card className="p-4 bg-card border-border">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("orderId")}</span>
                <span className="text-foreground font-mono">{order.orderNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("created")}</span>
                <span className="text-foreground">{formatDate(order.createdAt)}</span>
              </div>
              {order.confirmedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("confirmed")}</span>
                  <span className="text-foreground">{formatDate(order.confirmedAt)}</span>
                </div>
              )}
              {order.exchangeRate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("exchangeRate")}</span>
                  <span className="text-foreground">{order.exchangeRate}</span>
                </div>
              )}
            </div>
          </Card>
        </section>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t("confirmTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("confirmDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">{t("totalAmount")}</span>
              <span className="text-lg font-bold text-primary">
                {formatPrice(order.overrideTotalSar || order.totalSar || 0)}
              </span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleConfirmOrder}
              disabled={isConfirming}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isConfirming ? (
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                t("confirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t("cancelTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("cancelDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="flex-1"
            >
              {t("keepOrder")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="flex-1"
            >
              {isCancelling ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t("cancelOrderBtn")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t("deleteItemTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("deleteItemDesc", { itemName: itemToDelete?.productNameSnapshot || "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setItemToDelete(null);
              }}
              className="flex-1"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteItem}
              disabled={deletingItemId !== null}
              className="flex-1"
            >
              {deletingItemId ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t("deleteItem")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
