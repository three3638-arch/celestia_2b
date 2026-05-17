"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  fetchProductsFrom1688,
  importProductsFrom1688,
} from "@/lib/actions/ali1688-import";
import type {
  Fetch1688Result,
  Import1688Result,
  SystemAttributeField,
} from "@/lib/actions/ali1688-import";
import { AlertCircle, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";

interface Ali1688ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "input" | "fetching" | "mapping" | "result";

const SYSTEM_ATTRIBUTE_OPTIONS: {
  value: SystemAttributeField;
  label: string;
}[] = [
  { value: "gemType", label: "宝石类型" },
  { value: "metalColor", label: "金属底色" },
  { value: "mainStoneSize", label: "主石尺寸" },
  { value: "size", label: "尺码" },
  { value: "chainLength", label: "链长度" },
  { value: "ignore", label: "(忽略)" },
];

export function Ali1688ImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: Ali1688ImportDialogProps) {
  // 步骤状态
  const [step, setStep] = useState<Step>("input");

  // Step 1: 输入参数
  const [referenceOfferId, setReferenceOfferId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [spuPrefix, setSpuPrefix] = useState("");
  const [exchangeRate, setExchangeRate] = useState("0.5814");
  const [maxCount, setMaxCount] = useState("");

  // 由后端商详反查得到的供应商 OpenID（用于入库阶段回传）
  const [resolvedSellerOpenId, setResolvedSellerOpenId] = useState("");

  // Step 2: 获取结果
  const [fetchResult, setFetchResult] = useState<Fetch1688Result | null>(null);
  const [fetchError, setFetchError] = useState("");

  // Step 3: 属性映射
  const [attributeMapping, setAttributeMapping] = useState<
    Record<string, SystemAttributeField>
  >({});

  // Step 4: 入库结果
  const [importResult, setImportResult] = useState<Import1688Result | null>(
    null
  );
  const [importLoading, setImportLoading] = useState(false);

  // SPU抬头大写转换
  const handleSpuPrefixChange = (value: string) => {
    setSpuPrefix(value.toUpperCase());
  };

  // 是否可以开始获取
  const canStartFetch = useMemo(() => {
    return (
      referenceOfferId.trim() !== "" &&
      supplierName.trim() !== "" &&
      spuPrefix.trim() !== "" &&
      maxCount.trim() !== "" &&
      Number(maxCount) > 0
    );
  }, [referenceOfferId, supplierName, spuPrefix, maxCount]);

  // Step 1 → Step 2: 开始获取
  const handleStartFetch = async () => {
    setStep("fetching");
    setFetchError("");
    setFetchResult(null);
    setResolvedSellerOpenId("");

    try {
      const result = await fetchProductsFrom1688({
        referenceOfferId: referenceOfferId.trim(),
        maxCount: Number(maxCount),
      });

      if (result.success && result.data) {
        setFetchResult(result);
        setResolvedSellerOpenId(result.data.sellerOpenId);

        if (result.data.products.length === 0) {
          setFetchError("未获取到任何商品数据");
          return;
        }

        // 初始化属性映射：所有属性默认为 ignore
        const initialMapping: Record<string, SystemAttributeField> = {};
        for (const category of result.data.categoryMappings) {
          for (const attr of category.attributes) {
            if (!(attr in initialMapping)) {
              initialMapping[attr] = "ignore";
            }
          }
        }
        setAttributeMapping(initialMapping);
        setStep("mapping");
      } else {
        setFetchError(result.error || "获取商品数据失败");
      }
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "获取商品数据时发生未知错误"
      );
    }
  };

  // Step 2: 重试
  const handleRetry = () => {
    setStep("input");
    setFetchError("");
    setFetchResult(null);
  };

  // Step 3 → Step 4: 确认并入库
  const handleConfirmImport = async () => {
    if (!fetchResult?.data) return;

    setImportLoading(true);
    try {
      const result = await importProductsFrom1688({
        products: fetchResult.data.products,
        attributeMapping: attributeMapping as Record<string, string>,
        spuPrefix: spuPrefix.trim(),
        supplierName: supplierName.trim(),
        sellerOpenId: resolvedSellerOpenId,
        exchangeRate: Number(exchangeRate) || 0.5814,
        promotionUrls: fetchResult.data.promotionUrls,
      });

      setImportResult(result);
      setStep("result");
    } catch (err) {
      setImportResult({
        success: false,
        error:
          err instanceof Error ? err.message : "入库时发生未知错误",
      });
      setStep("result");
    } finally {
      setImportLoading(false);
    }
  };

  // Step 4: 关闭
  const handleClose = () => {
    if (step === "result" && importResult?.success) {
      onSuccess();
    }
    // 重置所有状态
    setStep("input");
    setReferenceOfferId("");
    setSupplierName("");
    setSpuPrefix("");
    setExchangeRate("0.5814");
    setMaxCount("");
    setResolvedSellerOpenId("");
    setFetchResult(null);
    setFetchError("");
    setAttributeMapping({});
    setImportResult(null);
    setImportLoading(false);
    onOpenChange(false);
  };

  // 取消/返回
  const handleCancel = () => {
    if (step === "fetching") return; // 加载中不允许关闭
    handleClose();
  };

  // 更新属性映射
  const updateAttributeMapping = (
    attrName: string,
    value: SystemAttributeField
  ) => {
    setAttributeMapping((prev) => ({ ...prev, [attrName]: value }));
  };

  // 步骤标题
  const getStepTitle = () => {
    switch (step) {
      case "input":
        return "1688商品获取";
      case "fetching":
        return "正在获取商品数据";
      case "mapping":
        return "SKU属性映射确认";
      case "result":
        return "入库结果";
    }
  };

  // 步骤描述
  const getStepDescription = () => {
    switch (step) {
      case "input":
        return "输入供应商信息和获取参数，从1688获取商品数据";
      case "fetching":
        return "正在从1688获取商品数据，请稍候...";
      case "mapping":
        return "为每个1688属性选择对应的系统属性字段";
      case "result":
        return "商品入库操作已完成";
    }
  };

  // 是否正在加载（禁止关闭Dialog）
  const isLoading = step === "fetching" || importLoading;

  // 收集所有唯一属性名（按类目分组展示）
  const allUniqueAttributes = useMemo(() => {
    if (!fetchResult?.data?.categoryMappings) return [];
    const seen = new Set<string>();
    const result: { attrName: string; categories: string[] }[] = [];
    for (const category of fetchResult.data.categoryMappings) {
      for (const attr of category.attributes) {
        if (seen.has(attr)) {
          const existing = result.find((r) => r.attrName === attr);
          existing?.categories.push(category.categoryName);
        } else {
          seen.add(attr);
          result.push({ attrName: attr, categories: [category.categoryName] });
        }
      }
    }
    return result;
  }, [fetchResult]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isLoading) return;
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-2xl bg-card border-border"
        showCloseButton={!isLoading}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">{getStepTitle()}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {getStepDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: 输入参数 */}
        {step === "input" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                任一商品ID <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="该供应商任一商品的ID（数字），如 1050414942928"
                value={referenceOfferId}
                onChange={(e) => setReferenceOfferId(e.target.value)}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">
                系统将根据该商品ID自动反查供应商，并拉取其同店商品。可在 1688 商品详情页 URL（detail.1688.com/offer/<span className="font-medium">xxx</span>.html）中获取。
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                供应商名称 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="输入供应商名称"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                SPU抬头 <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="大写字母，如 XY"
                value={spuPrefix}
                onChange={(e) => handleSpuPrefixChange(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  现行汇率
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  获取商品数 <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="如 20"
                  value={maxCount}
                  onChange={(e) => setMaxCount(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 获取中 */}
        {step === "fetching" && (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-sm text-muted-foreground">
              正在从1688获取商品数据...
            </p>
          </div>
        )}

        {/* Step 2 错误状态 */}
        {step === "fetching" && fetchError && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-sm text-destructive font-medium mb-2">
              获取失败
            </p>
            <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </div>
        )}

        {/* Step 3: SKU属性映射确认 */}
        {step === "mapping" && fetchResult?.data && (
          <div className="space-y-4 py-2 max-h-[50vh] overflow-y-auto">
            {/* 类目概览 */}
            <div className="space-y-2">
              {fetchResult.data.categoryMappings.map((category) => (
                <div
                  key={category.categoryId}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {category.categoryName}
                  </span>
                  <span className="text-muted-foreground">
                    ({category.productCount} 个商品)
                  </span>
                </div>
              ))}
              <div className="text-sm text-muted-foreground">
                共 {fetchResult.data.products.length} 个商品，
                {allUniqueAttributes.length} 个待映射属性
              </div>
            </div>

            {/* 属性映射列表 */}
            <div className="space-y-3 border border-border rounded-lg p-3">
              {allUniqueAttributes.map(({ attrName, categories }) => (
                <div
                  key={attrName}
                  className="flex items-center gap-3 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {attrName}
                    </span>
                    {categories.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        出现在: {categories.join(", ")}
                      </span>
                    )}
                  </div>
                  <Select
                    value={attributeMapping[attrName] || "ignore"}
                    onValueChange={(value) =>
                      updateAttributeMapping(
                        attrName,
                        value as SystemAttributeField
                      )
                    }
                  >
                    <SelectTrigger className="w-[140px] bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSTEM_ATTRIBUTE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: 入库结果 */}
        {step === "result" && importResult && (
          <div className="py-4">
            {importResult.success ? (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <div className="text-center">
                  <p className="text-base font-medium text-foreground">
                    成功导入 {importResult.importedProducts ?? 0} 个商品，
                    {importResult.importedSkus ?? 0} 个SKU
                  </p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-destructive">
                        {importResult.errors.length} 个商品导入失败
                      </p>
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                        {importResult.errors.map((err, idx) => (
                          <div key={idx}>
                            商品 {err.offerId}: {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                  <p className="text-sm text-destructive font-medium">
                    入库失败
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {importResult.error || "未知错误"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部按钮 */}
        <DialogFooter className="gap-3">
          {step === "input" && (
            <>
              <Button
                variant="outline"
                className="border-border"
                onClick={handleCancel}
              >
                取消
              </Button>
              <Button onClick={handleStartFetch} disabled={!canStartFetch}>
                开始获取
              </Button>
            </>
          )}

          {step === "fetching" && !fetchError && (
            <Button
              variant="outline"
              className="border-border"
              onClick={handleCancel}
              disabled
            >
              取消
            </Button>
          )}

          {step === "fetching" && fetchError && (
            <Button variant="outline" onClick={handleRetry}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                className="border-border"
                onClick={handleCancel}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={importLoading}
              >
                {importLoading ? "入库中..." : "确认并入库"}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={handleClose}>关闭</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
