"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Package, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { getMyOrders, deleteOrder } from "@/lib/actions/order";
import { formatPrice, formatDate } from "@/lib/utils";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OrdersPageProps {
  params: Promise<{
    locale: string;
  }>;
}

const getOrderTabs = (t: (key: string) => string) => [
  { key: "ALL", label: t("all") },
  { key: "PENDING_QUOTE", label: t("pendingQuote") },
  { key: "QUOTED", label: t("quoted") },
  { key: "CONFIRMED", label: t("confirmed") },
  { key: "PARTIALLY_PAID", label: t("partiallyPaid") },
  { key: "FULLY_PAID", label: t("fullyPaid") },
  { key: "SHIPPED", label: t("shipped") },
  { key: "COMPLETED", label: t("completed") },
] as const;

type OrderTabKey = ReturnType<typeof getOrderTabs>[number]["key"];

interface OrderItem {
  id: string;
  orderNo: string;
  status: string;
  statusLabel: string;
  itemCount: number;
  totalSar: string | null;
  firstImage: string | null;
  createdAt: Date;
}

export default function OrdersPage({ params }: OrdersPageProps) {
  const router = useRouter();
  const t = useTranslations("orders");
  const [activeTab, setActiveTab] = useState<OrderTabKey>("ALL");
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [locale, setLocale] = useState<string>("en");
  
  // 删除相关状态
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const ORDER_TABS = getOrderTabs(t);

  // Get locale from params
  useEffect(() => {
    params.then((p) => setLocale(p.locale));
  }, [params]);

  const fetchOrders = useCallback(async (pageNum: number, status?: string) => {
    try {
      const result = await getMyOrders({
        page: pageNum,
        pageSize: 20,
        status: status === "ALL" ? undefined : status,
      });

      if (result.success && result.data) {
        if (pageNum === 1) {
          setOrders(result.data.items);
        } else {
          setOrders((prev) => [...prev, ...result.data!.items]);
        }
        setHasMore(result.data.hasMore);
      } else {
        toast.error(result.error || t("fetchFailed"));
      }
    } catch {
      toast.error(t("fetchFailed"));
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    setPage(1);
    fetchOrders(1, activeTab).finally(() => setIsLoading(false));
  }, [activeTab, fetchOrders]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await fetchOrders(nextPage, activeTab);
    setPage(nextPage);
    setIsLoadingMore(false);
  };
  
  // 删除订单处理
  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteOrder(deleteOrderId);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        setDeleteOrderId(null);
        // 重新加载订单列表
        setIsLoading(true);
        setPage(1);
        fetchOrders(1, activeTab).finally(() => setIsLoading(false));
      } else {
        toast.error(result.error || t("deleteFailed"));
      }
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 阻止事件冒泡的删除按钮点击处理
  const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setDeleteOrderId(orderId);
  };

  const getStatusColor = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
    if (!config) return "secondary";
    
    switch (config.color) {
      case "yellow":
        return "warning";
      case "blue":
        return "default";
      case "orange":
        return "secondary";
      case "green":
        return "success";
      case "cyan":
      case "emerald":
        return "default";
      case "purple":
        return "secondary";
      case "amber":
        return "warning";
      case "red":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Fragment>
      <div className="min-h-screen pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4">
          <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        </div>

        {/* Tab Bar */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex px-4 py-2 gap-2">
            {ORDER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>

      {/* Orders List */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 bg-card border-border">
              <div className="animate-pulse space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            </Card>
          ))
        ) : orders.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {t("noOrders")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("startShopping")}
            </p>
          </motion.div>
        ) : (
          // Orders list
          <>
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card
                  className="p-4 bg-card border-border cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => router.push(`/${locale}/storefront/orders/${order.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Order No & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          #{order.orderNo}
                        </span>
                        <Badge variant={getStatusColor(order.status) as never}>
                          {order.statusLabel}
                        </Badge>
                      </div>

                      {/* Item Count */}
                      <p className="text-sm text-muted-foreground">
                        {t("items", { count: order.itemCount })}
                      </p>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </p>

                      {/* Total & Action */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-semibold text-primary">
                          {order.totalSar
                            ? formatPrice(order.totalSar)
                            : t("pendingQuote")}
                        </span>
                        <div className="flex items-center gap-2">
                          {order.status === "CANCELLED" && (
                            <button
                              onClick={(e) => handleDeleteClick(e, order.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="flex items-center text-muted-foreground text-sm">
                            <span>{t("view")}</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Thumbnail */}
                    {order.firstImage && (
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 ms-3">
                        <Image
                          src={order.firstImage}
                          alt="Order item"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="pt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    t("loadMore")
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    
    {/* 删除确认对话框 */}
      <Dialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <DialogContent>
          <DialogTitle>{t("deleteOrder")}</DialogTitle>
          <DialogDescription>
            {t("deleteConfirm")}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOrderId(null)}
              disabled={isDeleting}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={isDeleting}
            >
              {isDeleting ? t("loading") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
