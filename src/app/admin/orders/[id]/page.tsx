"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  User,
  Calendar,
  Tag,
  Truck,
  CreditCard,
  AlertCircle,
  ExternalLink,
  Edit,
  X,
  DollarSign,
  TrendingUp,
  ImageIcon,
  Calculator,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PaymentForm } from "@/components/admin/payment-form";
import { ShippingForm } from "@/components/admin/shipping-form";
import {
  getAdminOrderDetail,
  adminCancelOrder,
} from "@/lib/actions/order";
import { ORDER_STATUS_CONFIG, ORDER_ITEM_STATUS_CONFIG } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

// 状态颜色映射
const statusColorMap: Record<string, string> = {
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
};

// 付款方式映射
const paymentMethodMap: Record<string, string> = {
  BANK_TRANSFER: "银行转账",
  WESTERN_UNION: "西联汇款",
  CASH: "现金",
  OTHER: "其他",
};

// 运输方式映射
const shippingMethodMap: Record<string, string> = {
  SEA_FREIGHT: "海运",
  AIR_FREIGHT: "空运",
  EXPRESS: "快递",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string>("");
  const [order, setOrder] = useState<{
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
    settlementTotalCny: string | null;
    settlementTotalSar: string | null;
    totalAmountSar: string | null;
    estimatedProfit: string | null;
    actualProfit: string | null;
    createdAt: Date;
    confirmedAt: Date | null;
    customer: {
      id: string;
      name: string;
      phone: string;
      markupRatio: string;
    };
    items: Array<{
      id: string;
      skuId: string;
      productNameSnapshot: string;
      skuDescSnapshot: string;
      quantity: number;
      unitPriceCny: string | null;
      unitPriceSar: string | null;
      itemStatus: string;
      productImage: string | null;
      supplier: string | null;
      supplierLink: string | null;
      spuCode: string | null;
      settlementQty: number | null;
      settlementPriceCny: string | null;
      settlementPriceSar: string | null;
      isReturned: boolean;
    }>;
    payments: Array<{
      id: string;
      amountSar: string;
      method: string;
      proofUrl: string | null;
      note: string | null;
      confirmedAt: Date;
    }>;
    shipping: {
      id: string;
      trackingNo: string | null;
      trackingUrl: string | null;
      method: string | null;
      note: string | null;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialog 状态
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // 解析 params
  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  // 加载订单详情
  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const result = await getAdminOrderDetail(orderId);
      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error || "加载订单详情失败");
      }
    } catch (err) {
      setError("加载订单详情失败，请重试");
      console.error("Failed to load order:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // 取消订单
  const handleCancelOrder = async () => {
    if (!orderId) return;
    setCancelLoading(true);
    try {
      const result = await adminCancelOrder(orderId);
      if (result.success) {
        setCancelDialogOpen(false);
        loadOrder();
      } else {
        setError(result.error || "取消订单失败");
      }
    } catch (err) {
      setError("取消订单失败，请重试");
    } finally {
      setCancelLoading(false);
    }
  };

  // 计算付款总额
  const totalPaid = order?.payments.reduce(
    (sum, p) => sum + parseFloat(p.amountSar),
    0
  ) || 0;
  
  // 结算状态判断
  const hasSettlement = order ? ['SETTLING', 'COMPLETED'].includes(order.status) : false;
  
  // 报价总额（用于显示）
  const quotedTotalSar = order?.totalSar ? parseFloat(order.totalSar) : 0;

  // 计算实际成本合计：Σ(unitPriceCny × displayQty)
  // 成本单价永远是 unitPriceCny，不能用 settlementTotalCny（它可能是用 settlementPriceCny 计算的）
  const calculatedTotalCostCny = order?.items.reduce((sum, item) => {
    if (item.itemStatus === 'CUSTOMER_REMOVED') return sum
    const displayQty = hasSettlement && item.settlementQty !== null
      ? item.settlementQty
      : item.quantity;
    const unitCost = item.unitPriceCny ? parseFloat(item.unitPriceCny) : 0;
    return sum + unitCost * displayQty;
  }, 0) || 0;

  // 结算后SAR合计（从各行小计求和）
  const calculatedTotalSar = order?.items.reduce((sum, item) => {
    if (item.itemStatus === 'CUSTOMER_REMOVED') return sum
    const displayQty = hasSettlement && item.settlementQty !== null
      ? item.settlementQty
      : item.quantity;
    const displayPriceSar = hasSettlement && item.settlementPriceSar
      ? item.settlementPriceSar
      : item.unitPriceSar;
    return sum + (displayPriceSar ? parseFloat(displayPriceSar) * displayQty : 0);
  }, 0) || 0;

  // 前端重算预估/实际毛利
  const calculatedProfit = (() => {
    if (!order?.exchangeRate) return null;
    const exchangeRate = parseFloat(order.exchangeRate);
    if (exchangeRate <= 0) return null;
    return (calculatedTotalSar / exchangeRate) - calculatedTotalCostCny;
  })();

  // 前端重算毛利率
  const calculatedProfitMargin = calculatedProfit !== null && calculatedTotalCostCny > 0
    ? (calculatedProfit / calculatedTotalCostCny * 100).toFixed(1)
    : null;

  // 应付总额：优先使用结算后应付额，否则用前端计算的 calculatedTotalSar
  const payableAmount = order
    ? (order.totalAmountSar 
        ? parseFloat(order.totalAmountSar)
        : calculatedTotalSar)
    : 0;
  
  // 差额 = 应付总额 - 已付总额
  const remainingAmount = payableAmount - totalPaid;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <LoadingSpinner className="h-10 w-10" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">订单不存在或已被删除</p>
        <Button
          variant="outline"
          className="mt-4 border-border"
          onClick={() => router.push("/admin/orders")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回订单列表
        </Button>
      </div>
    );
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG];
  const statusColorClass = statusConfig ? statusColorMap[statusConfig.color] : statusColorMap.blue;

  // 判断可操作状态
  const canQuote = ["PENDING_QUOTE", "NEGOTIATING", "QUOTED"].includes(order.status);
  const canAddPayment = ["CONFIRMED", "PARTIALLY_PAID", "SETTLING"].includes(order.status);
  const canAddShipping = ["PARTIALLY_PAID", "FULLY_PAID"].includes(order.status);
  const canSettle = ["SHIPPED", "SETTLING", "COMPLETED"].includes(order.status);
  const canCancel = !["COMPLETED", "CANCELLED"].includes(order.status);
  
  // 是否有结算数据
  const hasSettlementData = order.actualProfit !== null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* 顶部固定区域 */}
      <div className="shrink-0 space-y-4 mb-6">
        {/* 返回按钮 */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:bg-card"
            onClick={() => router.push("/admin/orders")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
        </div>

        {/* 错误提示 */}
        {error && <ErrorAlert message={error} />}

        {/* 订单信息头 + 操作按钮 */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* 左侧：订单基本信息 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold text-foreground">
                    {order.orderNo}
                  </span>
                  <Badge variant="outline" className={statusColorClass}>
                    {order.statusLabel}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.createdAt, "zh")}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {order.customer.name}
                  </span>
                  <span>{order.customer.phone}</span>
                </div>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex flex-wrap items-center gap-2">
                {canQuote && (
                  <Link href={`/admin/orders/${orderId}/quote`}>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium"
                    >
                      <Tag className="h-4 w-4 mr-1" />
                      去报价
                    </Button>
                  </Link>
                )}
                {canAddPayment && (
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setPaymentDialogOpen(true)}
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    录入付款
                  </Button>
                )}
                {canSettle && (
                  <Link href={`/admin/orders/${orderId}/settlement`}>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium"
                    >
                      <Calculator className="h-4 w-4 mr-1" />
                      {order.status === "COMPLETED" ? "查看结算" : "进入结算"}
                    </Button>
                  </Link>
                )}
                {canCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    取消订单
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主内容区域：桌面端左右分栏，移动端垂直堆叠 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* 左侧：商品明细 */}
        <div className="lg:w-2/3 flex flex-col min-h-0">
          <Card className="bg-card border-border flex-1 flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                商品明细
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto min-h-0">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground bg-card">商品</TableHead>
                    <TableHead className="text-muted-foreground bg-card">SKU</TableHead>
                    <TableHead className="text-muted-foreground bg-card">供应商</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-center">数量</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-right">成本单价(CNY)</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-right">客户单价(SAR)</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-right">小计(CNY)</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-right">小计(SAR)</TableHead>
                    <TableHead className="text-muted-foreground bg-card text-center">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    // 结算后使用结算数据，否则使用报价数据
                    const displayQty = hasSettlement && item.settlementQty !== null 
                      ? item.settlementQty 
                      : item.quantity;
                                      
                    // 成本单价(CNY)：报价确认后永远不变，始终使用 unitPriceCny
                    const unitCostCny = item.unitPriceCny;
                                      
                    // 客户单价(SAR)：结算后可能变化
                    const displayPriceSar = hasSettlement && item.settlementPriceSar
                      ? item.settlementPriceSar
                      : item.unitPriceSar;
                                      
                    // 小计计算
                    // 小计(CNY)：成本单价 × 数量（成本不变，数量可能变）
                    const subtotalCny = unitCostCny
                      ? (parseFloat(unitCostCny) * displayQty).toFixed(2)
                      : null;
                    // 小计(SAR)：结算后用结算单价，否则用报价单价
                    const subtotalSar = displayPriceSar
                      ? (parseFloat(displayPriceSar) * displayQty).toFixed(2)
                      : null;
                                      
                    const isOutOfStock = item.itemStatus === "OUT_OF_STOCK";
                    const isReturned = item.isReturned;
                    const qtyChanged = hasSettlement && item.settlementQty !== null && item.settlementQty !== item.quantity;
                    // 客户单价(SAR)是否有变化
                    const sarPriceChanged = hasSettlement && item.settlementPriceSar && item.unitPriceSar && 
                      parseFloat(item.settlementPriceSar) !== parseFloat(item.unitPriceSar);
                  
                    return (
                      <TableRow key={item.id} className={`border-border ${isReturned ? "opacity-50" : ""}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productNameSnapshot}
                                className="w-10 h-10 rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="text-sm text-foreground block">{item.productNameSnapshot}</span>
                              {item.spuCode && (
                                <span className="text-xs text-muted-foreground">{item.spuCode}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.skuDescSnapshot}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.supplier ? (
                            <div className="flex items-center gap-1">
                              <span className="text-foreground">{item.supplier}</span>
                              {item.supplierLink && (
                                <a
                                  href={item.supplierLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:text-primary/80"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          ) : item.supplierLink ? (
                            <a
                              href={item.supplierLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-foreground">
                          {qtyChanged ? (
                            <span>
                              <span className="line-through text-muted-foreground">{item.quantity}</span>
                              <span className="mx-1">→</span>
                              <span className="text-primary">{displayQty}</span>
                            </span>
                          ) : (
                            displayQty
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {/* 成本单价(CNY)永远不变，始终显示报价时的 unitPriceCny */}
                          {unitCostCny ? `¥${unitCostCny}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {/* 客户单价(SAR)结算后可能变化 */}
                          {sarPriceChanged ? (
                            <span>
                              <span className="line-through text-muted-foreground">SAR {item.unitPriceSar}</span>
                              <span className="mx-1">→</span>
                              <span className="text-primary">SAR {displayPriceSar}</span>
                            </span>
                          ) : displayPriceSar ? `SAR ${displayPriceSar}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {subtotalCny ? `¥${subtotalCny}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {subtotalSar ? `SAR ${subtotalSar}` : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {isReturned ? (
                            <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                              退货
                            </Badge>
                          ) : isOutOfStock ? (
                            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                              缺货
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {ORDER_ITEM_STATUS_CONFIG[item.itemStatus as keyof typeof ORDER_ITEM_STATUS_CONFIG]?.label_zh || item.itemStatus}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* 合计行 */}
                  <TableRow className="border-border bg-muted/30 font-medium">
                    <TableCell colSpan={6} className="text-right text-foreground">
                      合计
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {hasSettlement ? (
                        <span>
                          {order.totalCny && calculatedTotalCostCny !== parseFloat(order.totalCny) && (
                            <span className="line-through text-muted-foreground mr-1">¥{order.totalCny}</span>
                          )}
                          <span className="text-primary">¥{calculatedTotalCostCny.toFixed(2)}</span>
                        </span>
                      ) : order.totalCny ? `¥${order.totalCny}` : "-"}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {hasSettlement ? (
                        <span>
                          {order.totalSar && calculatedTotalSar !== parseFloat(order.totalSar) && (
                            <span className="line-through text-muted-foreground mr-1">SAR {order.totalSar}</span>
                          )}
                          <span className="text-primary">SAR {calculatedTotalSar.toFixed(2)}</span>
                        </span>
                      ) : order.totalSar ? `SAR ${order.totalSar}` : "-"}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：金额汇总、付款记录、物流信息、结算信息 */}
        <div className="lg:w-1/3 flex flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          {/* 金额汇总 */}
          <Card className="bg-card border-border shrink-0">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                金额汇总
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">汇率</div>
                  <div className="text-sm font-medium text-foreground">
                    {order.exchangeRate ? `${order.exchangeRate} SAR/CNY` : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">加价比例</div>
                  <div className="text-sm font-medium text-foreground">
                    {order.markupRatio ? `${(parseFloat(order.markupRatio) * 100).toFixed(0)}%` : "-"}
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">成本总价(CNY)</span>
                  <span className="text-sm font-medium text-foreground">
                    {hasSettlement ? (
                      <span>
                        {order.totalCny && calculatedTotalCostCny !== parseFloat(order.totalCny) && (
                          <span className="line-through text-muted-foreground mr-1">¥{order.totalCny}</span>
                        )}
                        <span className="text-primary">¥{calculatedTotalCostCny.toFixed(2)}</span>
                      </span>
                    ) : order.totalCny ? `¥${order.totalCny}` : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">客户总价(SAR)</span>
                  <span className="text-sm font-medium text-foreground">
                    {hasSettlement ? (
                      <span>
                        {order.totalSar && calculatedTotalSar !== parseFloat(order.totalSar) && (
                          <span className="line-through text-muted-foreground mr-1">SAR {order.totalSar}</span>
                        )}
                        <span className="text-primary">SAR {calculatedTotalSar.toFixed(2)}</span>
                      </span>
                    ) : order.totalSar ? `SAR ${order.totalSar}` : "-"}
                  </span>
                </div>
                {order.overrideTotalSar && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">手动覆盖价(SAR)</span>
                    <span className="text-sm font-medium text-amber-400">
                      SAR {order.overrideTotalSar}
                    </span>
                  </div>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">预估毛利</span>
                  <span className={`text-sm font-medium ${calculatedProfit !== null && calculatedProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {calculatedProfit !== null
                      ? `${calculatedProfit >= 0 ? "+" : ""}¥${calculatedProfit.toFixed(2)}`
                      : "-"}
                  </span>
                </div>
                {calculatedProfitMargin !== null && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">毛利率</span>
                    <span className={`text-sm font-medium ${parseFloat(calculatedProfitMargin) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {calculatedProfitMargin}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 付款记录 */}
          <Card className="bg-card border-border shrink-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                付款记录
              </CardTitle>
              {canAddPayment && (
                <Button
                  size="sm"
                  onClick={() => setPaymentDialogOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  录入
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {order.payments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无付款记录</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {order.payments.map((payment) => (
                      <div key={payment.id} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-foreground">
                            SAR {payment.amountSar}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {paymentMethodMap[payment.method] || payment.method}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{formatDate(payment.confirmedAt, "zh")}</span>
                          {payment.proofUrl && (
                            <a
                              href={payment.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <ImageIcon className="h-3 w-3" />
                              凭证
                            </a>
                          )}
                        </div>
                        {payment.note && (
                          <div className="mt-2 text-xs text-muted-foreground truncate">
                            {payment.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* 付款汇总 */}
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">已付总额</span>
                      <span className="font-medium text-foreground">SAR {totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">应付总额</span>
                      <span className="font-medium text-foreground">
                        {hasSettlement && order.totalSar && calculatedTotalSar !== parseFloat(order.totalSar) ? (
                          <span>
                            <span className="line-through text-muted-foreground mr-1">SAR {quotedTotalSar.toFixed(2)}</span>
                            <span className="text-primary">SAR {payableAmount.toFixed(2)}</span>
                          </span>
                        ) : (
                          `SAR ${payableAmount.toFixed(2)}`
                        )}
                      </span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">差额</span>
                      <span className={`font-medium ${remainingAmount > 0 ? "text-red-400" : remainingAmount < 0 ? "text-green-400" : "text-foreground"}`}>
                        {remainingAmount > 0 ? "应补 " : remainingAmount < 0 ? "应退 " : ""}SAR {Math.abs(remainingAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 物流信息 */}
          <Card className="bg-card border-border shrink-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                物流信息
              </CardTitle>
              {canAddShipping && !order.shipping && (
                <Button
                  size="sm"
                  onClick={() => setShippingDialogOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Truck className="h-4 w-4 mr-1" />
                  录入
                </Button>
              )}
              {order.shipping && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShippingDialogOpen(true)}
                  className="border-border hover:bg-card"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  修改
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!order.shipping ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无物流信息</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">物流单号</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.shipping.trackingNo || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">运输方式</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.shipping.method ? shippingMethodMap[order.shipping.method] : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">运费</span>
                    <span className="text-sm font-medium text-foreground">
                      {order.shippingCostCny ? `¥${order.shippingCostCny}` : "-"}
                    </span>
                  </div>
                  {order.shipping.trackingUrl && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">查询链接</span>
                      <a
                        href={order.shipping.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        查看物流
                      </a>
                    </div>
                  )}
                  {order.shipping.note && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-sm text-muted-foreground">备注：</span>
                      <span className="text-sm text-foreground">{order.shipping.note}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 结算摘要（有结算数据时显示） */}
          {hasSettlementData && (
            <Card className="bg-card border-border shrink-0">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  结算摘要
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">实际毛利</span>
                    <span className={`text-sm font-medium ${order.actualProfit && parseFloat(order.actualProfit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {order.actualProfit
                        ? `${parseFloat(order.actualProfit) >= 0 ? "+" : ""}¥${order.actualProfit}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">毛利差异</span>
                    <span className={`text-sm font-medium ${
                      order.estimatedProfit && order.actualProfit && 
                      (parseFloat(order.actualProfit) - parseFloat(order.estimatedProfit)) >= 0 
                        ? "text-green-400" : "text-red-400"
                    }`}>
                      {order.estimatedProfit && order.actualProfit
                        ? `${parseFloat(order.actualProfit) - parseFloat(order.estimatedProfit) >= 0 ? "+" : ""}¥${(parseFloat(order.actualProfit) - parseFloat(order.estimatedProfit)).toFixed(2)}`
                        : "-"}
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <Link href={`/admin/orders/${orderId}/settlement`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-primary/50 text-primary hover:bg-primary/10"
                    >
                      查看结算详情
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 付款录入 Dialog */}
      <PaymentForm
        orderId={orderId}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        onSuccess={loadOrder}
      />

      {/* 物流录入 Dialog */}
      <ShippingForm
        orderId={orderId}
        shipping={order.shipping}
        open={shippingDialogOpen}
        onOpenChange={setShippingDialogOpen}
        onSuccess={loadOrder}
      />

      {/* 取消订单确认 Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              确认取消订单
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              取消后订单将变为「已取消」状态，此操作不可撤销。如果订单已有付款记录，请先处理退款事宜。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={cancelLoading}
            >
              {cancelLoading ? "处理中..." : "确认取消"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
