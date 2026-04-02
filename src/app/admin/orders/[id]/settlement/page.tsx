"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Calculator,
  AlertCircle,
  Save,
  CheckCircle,
  ImageIcon,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import {
  getSettlementDetail,
  updateSettlement,
  confirmSettlement,
  type SettlementDetail,
  type SettlementItemDetail,
} from "@/lib/actions/settlement";
import { ORDER_ITEM_STATUS_CONFIG } from "@/lib/constants";

interface SettlementPageProps {
  params: Promise<{ id: string }>;
}

// 可编辑的结算项状态
interface EditableItem {
  orderItemId: string;
  settlementQty: number;
  settlementPriceSar: string;  // 管理员输入的结算单价(SAR)
  isReturned: boolean;
  note: string;
}

export default function SettlementPage({ params }: SettlementPageProps) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string>("");
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 可编辑状态
  const [editableItems, setEditableItems] = useState<Map<string, EditableItem>>(new Map());
  const [settlementNote, setSettlementNote] = useState("");

  // Dialog 状态
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 显示/隐藏 CNY 相关列
  const [showCny, setShowCny] = useState(false);

  // 解析 params
  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  // 加载结算详情
  const loadSettlement = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const result = await getSettlementDetail(orderId);
      if (result.success && result.data) {
        setSettlement(result.data);
        setSettlementNote(result.data.settlementNote || "");

        // 初始化可编辑项
        const itemsMap = new Map<string, EditableItem>();
        result.data.items.forEach((item) => {
          itemsMap.set(item.orderItemId, {
            orderItemId: item.orderItemId,
            settlementQty: item.settlementQty,
            settlementPriceSar: item.settlementPriceSar,  // 使用接口返回的 SAR 价格
            isReturned: item.isReturned,
            note: item.note || "",
          });
        });
        setEditableItems(itemsMap);
      } else {
        setError(result.error || "加载结算详情失败");
      }
    } catch (err) {
      setError("加载结算详情失败，请重试");
      console.error("Failed to load settlement:", err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadSettlement();
  }, [loadSettlement]);

  // 更新单个项
  const updateItem = (
    orderItemId: string,
    field: keyof EditableItem,
    value: string | number | boolean
  ) => {
    setEditableItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(orderItemId);
      if (item) {
        // 如果是退货，自动设置数量为0
        if (field === "isReturned" && value === true) {
          newMap.set(orderItemId, {
            ...item,
            isReturned: true,
            settlementQty: 0,
          });
        } else {
          newMap.set(orderItemId, {
            ...item,
            [field]: value,
          });
        }
      }
      return newMap;
    });
  };

  // 计算实时结算总额
  const calculateTotals = useCallback(() => {
    if (!settlement) return { cny: "0.00", sar: "0.00", costCny: "0.00", profit: "0.00" };

    let totalCny = 0;
    let totalSar = 0;
    let totalCostCny = 0;
    let totalProfit = 0;

    settlement.items.forEach((item) => {
      const editable = editableItems.get(item.orderItemId);
      if (editable) {
        const qty = editable.isReturned ? 0 : editable.settlementQty;
        const priceSar = parseFloat(editable.settlementPriceSar) || 0;
        const subtotalSar = qty * priceSar;

        // 反算 CNY 价格：结算单价(CNY) = 结算单价(SAR) / 汇率
        const exchangeRate = parseFloat(settlement.exchangeRate || "0");
        const priceCny = exchangeRate > 0 ? priceSar / exchangeRate : 0;
        const subtotalCny = qty * priceCny;

        // 计算成本
        const costPriceCny = parseFloat(item.quotePriceCny || "0");
        const costSubtotal = qty * costPriceCny;
        
        // 计算毛利
        const profit = subtotalCny - costSubtotal;

        totalCny += subtotalCny;
        totalSar += subtotalSar;
        totalCostCny += costSubtotal;
        totalProfit += profit;
      }
    });

    return {
      cny: totalCny.toFixed(2),
      sar: totalSar.toFixed(2),
      costCny: totalCostCny.toFixed(2),
      profit: totalProfit.toFixed(2),
    };
  }, [settlement, editableItems]);

  // 保存结算
  const handleSave = async () => {
    if (!settlement) return;

    setSaving(true);
    setError("");
    try {
      const items = Array.from(editableItems.values()).map((item) => ({
        orderItemId: item.orderItemId,
        settlementQty: item.settlementQty,
        settlementPriceSar: item.settlementPriceSar,  // 传递 SAR 价格
        isReturned: item.isReturned,
        note: item.note || undefined,
      }));

      const result = await updateSettlement(orderId, {
        items,
        settlementNote: settlementNote || undefined,
      });

      if (result.success) {
        loadSettlement();
      } else {
        setError(result.error || "保存失败");
      }
    } catch (err) {
      setError("保存失败，请重试");
      console.error("Failed to save settlement:", err);
    } finally {
      setSaving(false);
    }
  };

  // 确认结算
  const handleConfirm = async () => {
    if (!orderId) return;

    setConfirming(true);
    try {
      const result = await confirmSettlement(orderId);
      if (result.success) {
        setConfirmDialogOpen(false);
        router.push(`/admin/orders/${orderId}`);
      } else {
        setError(result.error || "确认失败");
      }
    } catch (err) {
      setError("确认失败，请重试");
      console.error("Failed to confirm settlement:", err);
    } finally {
      setConfirming(false);
    }
  };

  // 格式化差异显示
  const formatDifference = (value: string, isSar: boolean = false) => {
    const num = parseFloat(value);
    const prefix = isSar ? "SAR " : "¥";
    if (num > 0) {
      return { text: `+${prefix}${value}`, color: "text-green-400" };
    } else if (num < 0) {
      return { text: `${prefix}${value}`, color: "text-red-400" };
    }
    return { text: `${prefix}${value}`, color: "text-muted-foreground" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <LoadingSpinner className="h-10 w-10" />
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">{error || "无法加载结算详情"}</p>
        <Button
          variant="outline"
          className="mt-4 border-border"
          onClick={() => router.push(`/admin/orders/${orderId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回订单详情
        </Button>
      </div>
    );
  }

  const totals = calculateTotals();
  // CNY 差异 = SAR 差异 / 汇率，保持与 SAR 差异逻辑一致
  const exchangeRate = parseFloat(settlement.exchangeRate || "1");
  const differenceSar = (parseFloat(totals.sar) - parseFloat(settlement.quoteTotalSar)).toFixed(1);
  const differenceCny = (parseFloat(differenceSar) / exchangeRate).toFixed(2);
  const isCompleted = settlement.status === "COMPLETED";

  return (
    <div className="space-y-6">
        {/* 返回按钮 */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="border-border hover:bg-card"
            onClick={() => router.push(`/admin/orders/${orderId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回订单详情
          </Button>
        </div>

        {/* 错误提示 */}
        {error && <ErrorAlert message={error} />}

        {/* 标题 */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Calculator className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold text-foreground">
                    {settlement.orderNo} - 结算对账
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  汇率: {settlement.exchangeRate} SAR/CNY | 加价比例:{" "}
                  {settlement.markupRatio
                    ? `${(parseFloat(settlement.markupRatio) * 100).toFixed(0)}%`
                    : "-"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 左侧：结算明细表格 */}
          <div className="xl:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  结算明细
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">商品</TableHead>
                        <TableHead className="text-muted-foreground text-center">报价数量</TableHead>
                        {showCny && (
                          <TableHead className="text-muted-foreground text-right">成本单价(CNY)</TableHead>
                        )}
                        <TableHead className="text-muted-foreground text-right">报价小计</TableHead>
                        <TableHead className="text-muted-foreground text-center">结算数量</TableHead>
                        <TableHead className="text-muted-foreground text-right">结算单价(SAR)</TableHead>
                        {showCny && (
                          <TableHead className="text-muted-foreground text-right">结算单价(CNY)</TableHead>
                        )}
                        {showCny && (
                          <TableHead className="text-muted-foreground text-right">单件毛利</TableHead>
                        )}
                        <TableHead className="text-muted-foreground text-right">结算小计</TableHead>
                        <TableHead className="text-muted-foreground text-center">退货</TableHead>
                        <TableHead className="text-muted-foreground">备注</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlement.items.map((item) => {
                        const editable = editableItems.get(item.orderItemId);
                        if (!editable) return null;

                        const isReturned = editable.isReturned;
                        const settlementQty = isReturned ? 0 : editable.settlementQty;
                        const settlementPriceSar = parseFloat(editable.settlementPriceSar) || 0;
                        
                        // 反算 CNY 价格
                        const exchangeRate = parseFloat(settlement.exchangeRate || "0");
                        const settlementPriceCny = exchangeRate > 0 ? settlementPriceSar / exchangeRate : 0;
                        
                        // 计算单件毛利
                        const costPriceCny = parseFloat(item.quotePriceCny || "0");
                        const unitProfit = settlementPriceCny - costPriceCny;
                        
                        // 计算小计
                        const settlementSubtotalCny = (settlementQty * settlementPriceCny).toFixed(2);
                        const settlementSubtotalSar = (settlementQty * settlementPriceSar).toFixed(2);

                        return (
                          <TableRow
                            key={item.orderItemId}
                            className={`border-border ${isReturned ? "opacity-50 bg-muted/30" : ""}`}
                          >
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
                                <div className="min-w-0">
                                  <span className="text-sm text-foreground block truncate">
                                    {item.productNameSnapshot}
                                  </span>
                                  <span className="text-xs text-muted-foreground block truncate">
                                    {item.skuDescSnapshot}
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm text-foreground">
                              {item.quoteQty}
                            </TableCell>
                            {showCny && (
                              <TableCell className="text-right text-sm text-foreground">
                                {item.quotePriceCny ? `¥${item.quotePriceCny}` : "-"}
                              </TableCell>
                            )}
                            <TableCell className="text-right text-sm text-foreground">
                              {item.quoteSubtotalCny ? `¥${item.quoteSubtotalCny}` : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                max={item.quoteQty}
                                value={editable.settlementQty}
                                onChange={(e) =>
                                  updateItem(
                                    item.orderItemId,
                                    "settlementQty",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                disabled={isCompleted || isReturned}
                                className="w-20 h-8 text-center bg-background border-border"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={editable.settlementPriceSar}
                                onChange={(e) =>
                                  updateItem(
                                    item.orderItemId,
                                    "settlementPriceSar",
                                    e.target.value
                                  )
                                }
                                disabled={isCompleted}
                                className="w-24 h-8 text-right bg-background border-border"
                              />
                            </TableCell>
                            {showCny && (
                              <TableCell className="text-right text-sm text-foreground">
                                ¥{settlementPriceCny.toFixed(2)}
                              </TableCell>
                            )}
                            {showCny && (
                              <TableCell className={`text-right text-sm ${unitProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {unitProfit >= 0 ? "+" : ""}¥{unitProfit.toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="text-right text-sm text-foreground">
                              ¥{settlementSubtotalCny}
                              <div className="text-xs text-muted-foreground">
                                SAR {settlementSubtotalSar}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={editable.isReturned}
                                onCheckedChange={(checked) =>
                                  updateItem(item.orderItemId, "isReturned", checked === true)
                                }
                                disabled={isCompleted}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                placeholder="备注"
                                value={editable.note}
                                onChange={(e) =>
                                  updateItem(item.orderItemId, "note", e.target.value)
                                }
                                disabled={isCompleted}
                                className="w-24 h-8 bg-background border-border"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* 结算备注 */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">结算备注</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="输入结算备注..."
                  value={settlementNote}
                  onChange={(e) => setSettlementNote(e.target.value)}
                  disabled={isCompleted}
                  className="bg-background border-border min-h-[100px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* 右侧：汇总和操作 */}
          <div className="space-y-6">
            {/* 切换显示 CNY */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showCny}
                  onCheckedChange={setShowCny}
                  id="show-cny"
                />
                <label htmlFor="show-cny" className="text-sm text-muted-foreground cursor-pointer">
                  显示成本与毛利
                </label>
              </div>
            </div>

            {/* 差异对比面板 */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  差异对比
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 报价汇总 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">报价总额</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">CNY</div>
                      <div className="text-sm font-medium text-foreground">
                        ¥{settlement.quoteTotalCny}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">SAR</div>
                      <div className="text-sm font-medium text-foreground">
                        SAR {settlement.quoteTotalSar}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 结算汇总 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">结算总额</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">SAR</div>
                      <div className="text-sm font-medium text-foreground">
                        SAR {totals.sar}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">CNY</div>
                      <div className="text-sm font-medium text-foreground">
                        ¥{totals.cny}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 成本与毛利汇总 - 仅在显示CNY时展示 */}
                {showCny && (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">成本与毛利</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-muted/30 rounded">
                          <div className="text-xs text-muted-foreground">结算总成本(CNY)</div>
                          <div className="text-sm font-medium text-foreground">
                            ¥{totals.costCny}
                          </div>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <div className="text-xs text-muted-foreground">总毛利</div>
                          <div className={`text-sm font-medium ${parseFloat(totals.profit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {parseFloat(totals.profit) >= 0 ? "+" : ""}¥{totals.profit}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* 应补款/应退款 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">结算付款</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground">结算应付总额(SAR)</span>
                      <span className="text-sm font-medium text-foreground">SAR {totals.sar}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground">客户已付总额(SAR)</span>
                      <span className="text-sm font-medium text-foreground">SAR {settlement.paidTotalSar}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <span className="text-xs text-muted-foreground">
                        {parseFloat(totals.sar) - parseFloat(settlement.paidTotalSar) >= 0 ? "客户需补款" : "需退款给客户"}
                      </span>
                      <span className={`text-sm font-bold ${parseFloat(totals.sar) - parseFloat(settlement.paidTotalSar) >= 0 ? "text-amber-400" : "text-green-400"}`}>
                        SAR {Math.abs(parseFloat(totals.sar) - parseFloat(settlement.paidTotalSar)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 报价差异（结算总额 - 报价总额） */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">报价差异（结算-报价）</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">SAR</div>
                      <div className={`text-sm font-medium ${formatDifference(differenceSar, true).color}`}>
                        {formatDifference(differenceSar, true).text}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/30 rounded">
                      <div className="text-xs text-muted-foreground">CNY</div>
                      <div className={`text-sm font-medium ${formatDifference(differenceCny).color}`}>
                        {formatDifference(differenceCny).text}
                      </div>
                    </div>
                  </div>
                </div>

                {settlement.settlementNote && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">已保存备注</div>
                      <div className="text-sm text-foreground bg-muted/30 p-2 rounded">
                        {settlement.settlementNote}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isCompleted && (
                  <>
                    <Button
                      size="lg"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? "保存中..." : "保存结算"}
                    </Button>
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium"
                      onClick={() => setConfirmDialogOpen(true)}
                      disabled={saving || settlement.status !== "SETTLING"}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      确认结算
                    </Button>
                    {settlement.status === "SHIPPED" && (
                      <p className="text-xs text-muted-foreground text-center">
                        请先保存结算数据后再确认
                      </p>
                    )}
                  </>
                )}
                {isCompleted && (
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">结算已完成</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 毛利分析 */}
            {(settlement.status === "SETTLING" || isCompleted) && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    毛利分析
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">结算总额(SAR)</span>
                    <span className="text-sm font-medium text-foreground">
                      SAR {totals.sar}
                    </span>
                  </div>
                  {showCny && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">结算总额(CNY)</span>
                      <span className="text-sm font-medium text-foreground">
                        ¥{totals.cny}
                      </span>
                    </div>
                  )}
                  {showCny && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">结算总成本(CNY)</span>
                      <span className="text-sm font-medium text-foreground">
                        ¥{totals.costCny}
                      </span>
                    </div>
                  )}
                  {showCny && <Separator />}
                  {showCny && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">总毛利</span>
                      <span className={`text-sm font-medium ${parseFloat(totals.profit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {parseFloat(totals.profit) >= 0 ? "+" : ""}¥{totals.profit}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 确认结算 Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                确认结算
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                确认结算后，订单将变为「已完成」状态，结算数据将被锁定且不可修改。请确保所有结算数据准确无误。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">结算总额(SAR)</span>
                <span className="font-bold text-foreground">SAR {totals.sar}</span>
              </div>
              {showCny && (
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">结算总额(CNY)</span>
                  <span className="font-bold text-foreground">¥{totals.cny}</span>
                </div>
              )}
              {showCny && (
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">总毛利</span>
                  <span className={`font-bold ${parseFloat(totals.profit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {parseFloat(totals.profit) >= 0 ? "+" : ""}¥{totals.profit}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                className="border-border"
                onClick={() => setConfirmDialogOpen(false)}
                disabled={confirming}
              >
                取消
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black"
                onClick={handleConfirm}
                disabled={confirming}
              >
                {confirming ? "确认中..." : "确认结算"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
