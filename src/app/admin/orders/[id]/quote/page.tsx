"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  TrendingUp,
  Package,
  AlertCircle,
  CheckCircle,
  ImageIcon,
  ExternalLink,
  Edit3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getAdminOrderDetail, submitQuote, getLatestQuoteDefaults } from "@/lib/actions/order";
import { DEFAULT_MARKUP_RATIO, DEFAULT_EXCHANGE_RATE } from "@/lib/constants";

interface QuotePageProps {
  params: Promise<{ id: string }>;
}

// 计算客户价格（SAR）= CNY × 加价比例 × 汇率，向上取整1位小数
function calculateSarPrice(costCny: number, markupRatio: number, exchangeRate: number): number {
  return Math.ceil(costCny * markupRatio * exchangeRate * 10) / 10;
}

export default function QuotePage({ params }: QuotePageProps) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string>("");
  const [order, setOrder] = useState<{
    id: string;
    orderNo: string;
    status: string;
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
      productImage: string | null;
      supplier: string | null;
      supplierLink: string | null;
      spuCode: string | null;
      unitPriceCny: string | null;
      unitPriceSar: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 报价表单状态
  const [exchangeRate, setExchangeRate] = useState<string>(""); // 动态初始化
  const [markupRatio, setMarkupRatio] = useState<string>("");
  const [overrideTotalSar, setOverrideTotalSar] = useState<string>("");
  // 扩展 itemPrices：添加 customSarPrice 字段来跟踪自定义客户单价
  // customSarPrice: null 表示使用自动计算值；有值表示用户手动修改
  const [itemPrices, setItemPrices] = useState<Record<string, {
    price: string;
    outOfStock: boolean;
    customSarPrice: string | null; // null = 自动计算，有值 = 自定义
  }>>({});

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
        const { id, orderNo, status, customer, items, exchangeRate: savedExchangeRate, markupRatio: savedMarkupRatio } = result.data;
        setOrder({ id, orderNo, status, customer, items });

        // 初始化汇率和加价比例
        // 优先级：1. 订单已保存的值  2. 最近报价的默认值  3. 硬编码默认值
        if (savedExchangeRate) {
          // 订单已有汇率（再次报价），直接使用
          setExchangeRate(savedExchangeRate);
          setMarkupRatio(savedMarkupRatio || customer.markupRatio || DEFAULT_MARKUP_RATIO.toString());
        } else {
          // 首次报价，尝试获取最近报价的默认值
          const defaultsResult = await getLatestQuoteDefaults();
          if (defaultsResult.success && defaultsResult.data) {
            setExchangeRate(defaultsResult.data.exchangeRate || DEFAULT_EXCHANGE_RATE.toString());
            setMarkupRatio(defaultsResult.data.markupRatio || customer.markupRatio || DEFAULT_MARKUP_RATIO.toString());
          } else {
            // 没有历史报价，使用硬编码默认值
            setExchangeRate(DEFAULT_EXCHANGE_RATE.toString());
            setMarkupRatio(customer.markupRatio || DEFAULT_MARKUP_RATIO.toString());
          }
        }

        // 初始化 item 价格表单
        const initialPrices: Record<string, {
          price: string;
          outOfStock: boolean;
          customSarPrice: string | null;
        }> = {};
        items.forEach((item) => {
          initialPrices[item.id] = {
            price: item.unitPriceCny || "",
            outOfStock: false,
            customSarPrice: item.unitPriceSar || null,
          };
        });
        setItemPrices(initialPrices);
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

  // 更新 item 成本价
  const updateItemPrice = (itemId: string, price: string) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], price },
    }));
  };

  // 更新 item 缺货状态
  const updateItemOutOfStock = (itemId: string, checked: boolean) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        outOfStock: checked,
        price: checked ? "0" : prev[itemId]?.price || "",
        customSarPrice: checked ? null : prev[itemId]?.customSarPrice,
      },
    }));
  };

  // 更新 item 客户单价（手动修改）
  const updateItemSarPrice = (itemId: string, sarPrice: string) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], customSarPrice: sarPrice },
    }));
  };

  // 重置 item 客户单价为自动计算
  const resetItemSarPrice = (itemId: string) => {
    setItemPrices((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], customSarPrice: null },
    }));
  };

  // 计算自动客户单价
  const calculateAutoSarPrice = (costCny: string): number => {
    const cost = parseFloat(costCny);
    const markup = parseFloat(markupRatio || "1");
    const rate = parseFloat(exchangeRate || "0");
    if (isNaN(cost) || isNaN(markup) || isNaN(rate) || cost <= 0) return 0;
    return calculateSarPrice(cost, markup, rate);
  };

  // 获取客户单价（考虑自定义值）
  const getSarUnitPrice = (itemId: string): number => {
    const itemData = itemPrices[itemId];
    if (!itemData || itemData.outOfStock) return 0;

    // 如果有自定义客户单价，使用自定义值
    if (itemData.customSarPrice !== null && itemData.customSarPrice !== "") {
      const customPrice = parseFloat(itemData.customSarPrice);
      if (!isNaN(customPrice)) return customPrice;
    }

    // 否则自动计算
    return calculateAutoSarPrice(itemData.price);
  };

  // 判断是否为自定义价格
  const isCustomPrice = (itemId: string): boolean => {
    const itemData = itemPrices[itemId];
    return itemData?.customSarPrice !== null && itemData?.customSarPrice !== "";
  };

  // 计算成本小计
  const calculateCostSubtotal = (itemId: string, quantity: number): number => {
    const price = itemPrices[itemId]?.price;
    if (!price || isNaN(parseFloat(price))) return 0;
    return parseFloat(price) * quantity;
  };

  // 计算客户小计
  const calculateSarSubtotal = (itemId: string, quantity: number): number => {
    return getSarUnitPrice(itemId) * quantity;
  };

  // 汇总计算
  const summary = useMemo(() => {
    let totalCny = 0;
    let totalSar = 0;
    const markup = parseFloat(markupRatio || "1");
    const rate = parseFloat(exchangeRate || "0");

    order?.items.forEach((item) => {
      const itemData = itemPrices[item.id];
      if (itemData && !itemData.outOfStock) {
        const cost = parseFloat(itemData.price || "0");
        if (!isNaN(cost) && cost > 0) {
          totalCny += cost * item.quantity;

          // 计算客户单价：优先使用自定义值，否则自动计算
          let sarUnitPrice = 0;
          if (itemData.customSarPrice !== null && itemData.customSarPrice !== "") {
            const customPrice = parseFloat(itemData.customSarPrice);
            if (!isNaN(customPrice)) sarUnitPrice = customPrice;
          } else {
            sarUnitPrice = calculateSarPrice(cost, markup, rate);
          }
          totalSar += sarUnitPrice * item.quantity;
        }
      }
    });

    const finalTotalSar = overrideTotalSar ? parseFloat(overrideTotalSar) : totalSar;

    // 改进：毛利 = 客户总价等价CNY - 成本总价
    // SAR 等价 CNY = 客户总价(SAR) / 汇率
    const totalSarInCny = rate > 0 ? finalTotalSar / rate : 0;
    const estimatedProfit = totalSarInCny - totalCny;
    const profitMargin = totalCny > 0 ? (estimatedProfit / totalCny) * 100 : 0;

    return {
      totalCny: totalCny.toFixed(2),
      totalSar: finalTotalSar.toFixed(1),
      calculatedTotalSar: totalSar.toFixed(1),
      estimatedProfit: estimatedProfit.toFixed(2),
      profitMargin: profitMargin.toFixed(1),
    };
  }, [order, itemPrices, markupRatio, exchangeRate, overrideTotalSar]);

  // 提交报价
  const handleSubmitQuote = async () => {
    if (!orderId) return;

    // 验证
    const items = order?.items
      .filter((item) => !itemPrices[item.id]?.outOfStock)
      .map((item) => ({
        orderItemId: item.id,
        unitPriceCny: itemPrices[item.id]?.price,
        ...(itemPrices[item.id]?.customSarPrice ? { unitPriceSar: itemPrices[item.id].customSarPrice } : {}),
      }))
      .filter((item) => item.unitPriceCny && parseFloat(item.unitPriceCny) > 0);

    if (!items || items.length === 0) {
      setError("请至少填写一个商品的成本价");
      return;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      setError("请填写有效的汇率");
      return;
    }

    if (!markupRatio || parseFloat(markupRatio) <= 0) {
      setError("请填写有效的加价比例");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await submitQuote(orderId, {
        exchangeRate,
        markupRatio,
        items,
        overrideTotalSar: overrideTotalSar || undefined,
      });

      if (result.success) {
        router.push(`/admin/orders/${orderId}`);
      } else {
        setError(result.error || "提交报价失败");
      }
    } catch (err) {
      setError("提交报价失败，请重试");
      console.error("Failed to submit quote:", err);
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* 顶部固定：页面标题 */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center gap-4 mb-4">
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
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            订单报价
          </h2>
          <p className="text-muted-foreground mt-1">
            订单号：{order.orderNo} · 客户：{order.customer.name}
          </p>
        </div>
      </div>

      {/* 顶部固定：汇率与加价设置 */}
      <div className="shrink-0 mb-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4 text-primary" />
              汇率与加价设置
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              先设定汇率和加价比例，再填写成本价。客户默认加价比例为 {(parseFloat(order.customer.markupRatio || "1.15") * 100).toFixed(0)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="exchangeRate" className="text-foreground text-sm">
                  汇率 (CNY → SAR)
                </Label>
                <div className="relative">
                  <Input
                    id="exchangeRate"
                    type="number"
                    min="0.01"
                    step="0.001"
                    placeholder="0.520"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="bg-background border-border pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    SAR/CNY
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="markupRatio" className="text-foreground text-sm">
                  加价比例
                </Label>
                <div className="relative">
                  <Input
                    id="markupRatio"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="1.15"
                    value={markupRatio}
                    onChange={(e) => setMarkupRatio(e.target.value)}
                    className="bg-background border-border pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    倍
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="overrideTotal" className="text-foreground text-sm flex items-center gap-1">
                  手动覆盖总价(SAR)
                  <span className="text-xs text-muted-foreground">(可选)</span>
                </Label>
                <Input
                  id="overrideTotal"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="自动计算"
                  value={overrideTotalSar}
                  onChange={(e) => setOverrideTotalSar(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground text-sm">价格公式</Label>
                <div className="h-9 flex items-center text-sm text-muted-foreground bg-muted/30 rounded-md px-3">
                  客户单价 = 成本价 × 汇率 × 加价比例
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="shrink-0 mb-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* 中间滚动：商品表格 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <Card className="bg-card border-border h-full">
          <CardHeader className="pb-3 sticky top-0 bg-card z-10 border-b border-border">
            <CardTitle className="text-foreground flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-primary" />
              商品报价明细
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              填写成本单价，客户单价自动计算（可手动修改覆盖）
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground whitespace-nowrap">商品</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">SKU描述</TableHead>
                    <TableHead className="text-muted-foreground text-center whitespace-nowrap">数量</TableHead>
                    <TableHead className="text-muted-foreground whitespace-nowrap">供应商</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">成本单价(CNY)</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">成本小计(CNY)</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">客户单价(SAR)</TableHead>
                    <TableHead className="text-muted-foreground text-right whitespace-nowrap">客户小计(SAR)</TableHead>
                    <TableHead className="text-muted-foreground text-center whitespace-nowrap">缺货</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => {
                    const itemData = itemPrices[item.id];
                    const costSubtotal = calculateCostSubtotal(item.id, item.quantity);
                    const isOutOfStock = itemData?.outOfStock;
                    const sarUnitPrice = getSarUnitPrice(item.id);
                    const sarSubtotal = calculateSarSubtotal(item.id, item.quantity);
                    const hasCustomPrice = isCustomPrice(item.id);
                    const autoSarPrice = calculateAutoSarPrice(itemData?.price || "");

                    return (
                      <TableRow
                        key={item.id}
                        className={`border-border ${isOutOfStock ? "opacity-50" : ""} ${hasCustomPrice ? "bg-amber-500/5" : ""}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productNameSnapshot}
                                className="w-10 h-10 rounded object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-sm text-foreground block truncate">{item.productNameSnapshot}</span>
                              {item.spuCode && (
                                <span className="text-xs text-muted-foreground block truncate">{item.spuCode}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {item.skuDescSnapshot}
                        </TableCell>
                        <TableCell className="text-center text-sm text-foreground whitespace-nowrap">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
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
                        <TableCell className="text-right whitespace-nowrap">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={itemData?.price || ""}
                            onChange={(e) => updateItemPrice(item.id, e.target.value)}
                            disabled={isOutOfStock}
                            className="w-24 ml-auto text-right bg-background border-border"
                          />
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground whitespace-nowrap">
                          {isOutOfStock ? (
                            <span className="text-red-400">缺货</span>
                          ) : costSubtotal > 0 ? (
                            `¥${costSubtotal.toFixed(2)}`
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {isOutOfStock ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  placeholder={autoSarPrice > 0 ? autoSarPrice.toFixed(1) : "0.0"}
                                  value={itemData?.customSarPrice || ""}
                                  onChange={(e) => updateItemSarPrice(item.id, e.target.value)}
                                  className={`w-20 text-right bg-background ${
                                    hasCustomPrice
                                      ? "border-amber-500/50 focus-visible:ring-amber-500/30"
                                      : "border-border"
                                  }`}
                                />
                                {hasCustomPrice && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => resetItemSarPrice(item.id)}
                                    title="重置为自动计算"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground whitespace-nowrap">
                          {isOutOfStock ? (
                            "-"
                          ) : sarSubtotal > 0 ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>SAR {sarSubtotal.toFixed(1)}</span>
                              {hasCustomPrice && (
                                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400">
                                  自定义
                                </Badge>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Checkbox
                            checked={isOutOfStock}
                            onCheckedChange={(checked) => updateItemOutOfStock(item.id, checked as boolean)}
                            className="border-border"
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
      </div>

      {/* 底部固定：合计+毛利+提交按钮 */}
      <div className="shrink-0 mt-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
              {/* 合计区域 */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center md:text-left">
                  <div className="text-xs text-muted-foreground mb-1">总成本(CNY)</div>
                  <div className="text-lg font-semibold text-foreground">¥{summary.totalCny}</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-xs text-muted-foreground mb-1">总客户价(SAR)</div>
                  <div className="text-lg font-semibold text-foreground">
                    {overrideTotalSar ? (
                      <span>
                        <span className="line-through text-muted-foreground text-sm mr-2">
                          SAR {summary.calculatedTotalSar}
                        </span>
                        <span className="text-amber-400">SAR {summary.totalSar}</span>
                      </span>
                    ) : (
                      `SAR ${summary.totalSar}`
                    )}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-xs text-muted-foreground mb-1">预估毛利</div>
                  <div className={`text-lg font-semibold ${parseFloat(summary.estimatedProfit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {parseFloat(summary.estimatedProfit) >= 0 ? "+" : ""}¥{summary.estimatedProfit}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-xs text-muted-foreground mb-1">毛利率</div>
                  <div className={`text-lg font-semibold ${parseFloat(summary.profitMargin) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {summary.profitMargin}%
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border hover:bg-card"
                  onClick={() => router.push(`/admin/orders/${orderId}`)}
                  disabled={submitting}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Button>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium px-8"
                  onClick={handleSubmitQuote}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoadingSpinner className="h-4 w-4 mr-2" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      提交报价
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
