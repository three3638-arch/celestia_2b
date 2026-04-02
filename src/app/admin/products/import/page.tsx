"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  AlertCircle,
  ChevronRight,
  Package,
  Image as ImageIcon,
  Grid3X3,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseExcelTask, getImportPreview, confirmImport, getImportTaskStatus } from "@/lib/actions/import";

// ============================================================
// 类型定义
// ============================================================

type ImportStep = 1 | 2 | 3 | 4 | 5;

interface PreviewItem {
  spuCode: string;
  nameZh: string;
  nameEn: string;
  nameAr: string;
  categoryName: string;
  skuCount: number;
  primaryImageUrl: string | null;
  priceMin: string | null;
  priceMax: string | null;
  supplier: string | null;
  supplierLink: string | null;
}

interface ImportSummary {
  spuCount: number;
  skuCount: number;
  imageCount: number;
}

interface ImportResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  errors: { spuCode: string; error: string }[];
}

// ============================================================
// 步骤指示器组件
// ============================================================

const steps = [
  { id: 1, label: "上传" },
  { id: 2, label: "解析" },
  { id: 3, label: "预览" },
  { id: 4, label: "摘要" },
  { id: 5, label: "完成" },
];

function StepIndicator({ currentStep }: { currentStep: ImportStep }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 transition-colors",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 辅助函数：格式化价格区间
// ============================================================

function formatPriceRange(priceMin: string | null, priceMax: string | null): string {
  if (priceMin && priceMax) {
    return `SAR ${priceMin}~${priceMax}`;
  } else if (priceMin) {
    return `SAR ${priceMin} 起`;
  } else if (priceMax) {
    return `最高 SAR ${priceMax}`;
  }
  return "价格面议";
}

// ============================================================
// Step 1: 上传
// ============================================================

function UploadStep({
  onUploadComplete,
}: {
  onUploadComplete: (taskId: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      try {
        // 模拟进度
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/excel", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "上传失败");
        }

        // 延迟一下让用户看到 100% 进度
        setTimeout(() => {
          onUploadComplete(result.data.taskId);
        }, 300);
      } catch (err) {
        setError(err instanceof Error ? err.message : "上传失败");
        setIsUploading(false);
      }
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
    disabled: isUploading,
  });

  return (
    <div className="max-w-xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>

          <div>
            <p className="text-lg font-medium text-foreground">
              {isDragActive ? "释放文件以上传" : "拖拽 Excel 文件到此处"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              或点击选择文件，支持 .xlsx / .xls 格式
            </p>
          </div>

          {isUploading && (
            <div className="w-full max-w-xs mt-4">
              <Progress value={uploadProgress}>
                <ProgressLabel>上传进度</ProgressLabel>
                <ProgressValue />
              </Progress>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span>文件大小建议不超过 10MB</span>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium text-foreground mb-2">Excel 格式要求：</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>第1行：表头（SPU编号、首图、名称、品类、宝石类型、金属底色、尺码、长度、参考价最低、参考价最高、描述、其他图片）</p>
          <p>第2行起：商品数据，每行一个 SPU</p>
          <p>首图（B列）为必填，需嵌入图片；其他图片（L-P列）可选</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="border-b border-muted-foreground/20">
                <th className="py-1 px-2 text-left font-medium">列</th>
                <th className="py-1 px-2 text-left font-medium">字段</th>
                <th className="py-1 px-2 text-left font-medium">必填</th>
                <th className="py-1 px-2 text-left font-medium">说明</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">A</td>
                <td className="py-1 px-2">SPU编号</td>
                <td className="py-1 px-2 text-primary">是</td>
                <td className="py-1 px-2">唯一标识</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">B</td>
                <td className="py-1 px-2">首图</td>
                <td className="py-1 px-2 text-primary">是</td>
                <td className="py-1 px-2">嵌入图片</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">C</td>
                <td className="py-1 px-2">名称</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">为空时用SPU编号代替</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">D</td>
                <td className="py-1 px-2">品类</td>
                <td className="py-1 px-2 text-primary">是</td>
                <td className="py-1 px-2">戒指/项链/手链/耳钉/其他</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">E</td>
                <td className="py-1 px-2">宝石类型</td>
                <td className="py-1 px-2 text-primary">是</td>
                <td className="py-1 px-2">逗号分隔</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">F</td>
                <td className="py-1 px-2">金属底色</td>
                <td className="py-1 px-2 text-primary">是</td>
                <td className="py-1 px-2">逗号分隔</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">G</td>
                <td className="py-1 px-2">尺码</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">戒指用，逗号分隔</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">H</td>
                <td className="py-1 px-2">长度(cm)</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">项链/手链用</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">I</td>
                <td className="py-1 px-2">参考价最低(SAR)</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">价格区间下限</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">J</td>
                <td className="py-1 px-2">参考价最高(SAR)</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">价格区间上限</td>
              </tr>
              <tr className="border-b border-muted-foreground/10">
                <td className="py-1 px-2">K</td>
                <td className="py-1 px-2">描述</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">中文描述</td>
              </tr>
              <tr>
                <td className="py-1 px-2">L-P</td>
                <td className="py-1 px-2">其他图片</td>
                <td className="py-1 px-2">否</td>
                <td className="py-1 px-2">附加图片，嵌入</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: 解析中
// ============================================================

function ParsingStep({ taskId, onParsingComplete }: { taskId: string; onParsingComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("正在解析 Excel...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const startParsing = async () => {
      try {
        // 开始解析
        const result = await parseExcelTask(taskId);
        
        if (!result.success) {
          throw new Error(result.error || "解析失败");
        }

        // 轮询状态
        const checkStatus = async () => {
          if (isCancelled) return;

          const statusResult = await getImportTaskStatus(taskId);
          
          if (!statusResult.success) {
            throw new Error(statusResult.error || "获取状态失败");
          }

          const { status } = statusResult.data!;

          if (status === "ready") {
            setProgress(100);
            setStatusText("解析完成！");
            setTimeout(onParsingComplete, 500);
            return;
          } else if (status === "error") {
            throw new Error(statusResult.data!.error || "解析失败");
          }

          // 更新进度和状态文字
          setProgress((prev) => {
            const newProgress = Math.min(prev + Math.random() * 15 + 5, 95);
            if (newProgress > 30 && newProgress <= 50) {
              setStatusText("正在提取图片...");
            } else if (newProgress > 50 && newProgress <= 70) {
              setStatusText("正在翻译...");
            } else if (newProgress > 70) {
              setStatusText("正在展开 SKU...");
            }
            return newProgress;
          });

          setTimeout(checkStatus, 500);
        };

        checkStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析失败");
      }
    };

    startParsing();

    return () => {
      isCancelled = true;
    };
  }, [taskId, onParsingComplete]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          重新上传
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>

      <h3 className="text-lg font-medium text-foreground mb-2">{statusText}</h3>
      <p className="text-sm text-muted-foreground mb-6">
        请稍候，正在处理您的 Excel 文件...
      </p>

      <div className="w-full">
        <Progress value={progress}>
          <ProgressTrack className="h-2">
            <ProgressIndicator className="bg-gradient-to-r from-amber-500 to-yellow-400" />
          </ProgressTrack>
        </Progress>
        <p className="text-xs text-muted-foreground mt-2">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

// ============================================================
// Step 3: 预览
// ============================================================

function PreviewStep({
  taskId,
  onContinue,
}: {
  taskId: string;
  onContinue: () => void;
}) {
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const result = await getImportPreview(taskId);
        if (!result.success) {
          throw new Error(result.error || "加载预览失败");
        }
        setPreview(result.data!.preview as PreviewItem[]);
        setSummary(result.data!.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载预览失败");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [taskId]);

  const toggleRow = (spuCode: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(spuCode)) {
      newExpanded.delete(spuCode);
    } else {
      newExpanded.add(spuCode);
    }
    setExpandedRows(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {summary?.spuCount} 个商品，显示前 {preview.length} 个预览
        </p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead>首图</TableHead>
              <TableHead>SPU编号</TableHead>
              <TableHead>名称(中)</TableHead>
              <TableHead>品类</TableHead>
              <TableHead>参考价(SAR)</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead className="text-right">SKU数量</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.map((item) => (
              <React.Fragment key={item.spuCode}>
                <TableRow>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleRow(item.spuCode)}
                    >
                      {expandedRows.has(item.spuCode) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {item.primaryImageUrl ? (
                      <img
                        src={item.primaryImageUrl}
                        alt={item.spuCode}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.spuCode}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{item.nameZh}</TableCell>
                  <TableCell>{item.categoryName}</TableCell>
                  <TableCell className="text-amber-600 font-medium">
                    {formatPriceRange(item.priceMin, item.priceMax)}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-muted-foreground">
                    {item.supplier || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      <Grid3X3 className="w-3 h-3" />
                      {item.skuCount}
                    </span>
                  </TableCell>
                </TableRow>
                {expandedRows.has(item.spuCode) && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={8} className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">名称(英):</span>
                          <span className="ml-2">{item.nameEn}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">名称(阿):</span>
                          <span className="ml-2" dir="rtl">{item.nameAr}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">参考价:</span>
                          <span className="ml-2 text-amber-600">
                            {formatPriceRange(item.priceMin, item.priceMax)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={onContinue}>
          继续
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Step 4: 导入摘要
// ============================================================

function SummaryStep({
  taskId,
  onConfirm,
  onCancel,
}: {
  taskId: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      const result = await getImportPreview(taskId);
      if (result.success) {
        setSummary(result.data!.summary);
      }
      setLoading(false);
    };

    loadSummary();
  }, [taskId]);

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{summary?.spuCount}</p>
          <p className="text-sm text-muted-foreground mt-1">SPU 总数</p>
        </Card>

        <Card className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Grid3X3 className="w-6 h-6 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{summary?.skuCount}</p>
          <p className="text-sm text-muted-foreground mt-1">SKU 总数</p>
        </Card>

        <Card className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{summary?.imageCount}</p>
          <p className="text-sm text-muted-foreground mt-1">图片总数</p>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={confirming}>
          取消
        </Button>
        <Button
          className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              导入中...
            </>
          ) : (
            "确认导入"
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Step 5: 导入结果
// ============================================================

function ResultStep({
  result,
  onBackToList,
}: {
  result: ImportResult;
  onBackToList: () => void;
}) {
  const hasErrors = result.errors.length > 0;

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
        <Check className="w-10 h-10 text-green-500" />
      </div>

      <h3 className="text-xl font-medium text-foreground mb-2">导入完成</h3>
      <p className="text-muted-foreground mb-6">
        成功导入 {result.successCount} 个商品
        {result.skippedCount > 0 && `，跳过 ${result.skippedCount} 个`}
        {result.failedCount > 0 && `，失败 ${result.failedCount} 个`}
      </p>

      {hasErrors && (
        <Card className="p-4 mb-6 text-left">
          <h4 className="text-sm font-medium text-destructive mb-2">错误详情：</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {result.errors.map((err, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {err.spuCode}: {err.error}
              </p>
            ))}
          </div>
        </Card>
      )}

      <Button onClick={onBackToList}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回商品列表
      </Button>
    </div>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function ImportPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ImportStep>(1);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleUploadComplete = (newTaskId: string) => {
    setTaskId(newTaskId);
    setCurrentStep(2);
  };

  const handleParsingComplete = () => {
    setCurrentStep(3);
  };

  const handlePreviewContinue = () => {
    setCurrentStep(4);
  };

  const handleConfirmImport = async () => {
    if (!taskId) return;

    const result = await confirmImport(taskId);
    if (result.success) {
      setImportResult(result.data!);
      setCurrentStep(5);
    }
  };

  const handleCancel = () => {
    setCurrentStep(3);
  };

  const handleBackToList = () => {
    router.push("/admin/products");
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">批量导入商品</h1>
        <p className="text-muted-foreground mt-1">通过 Excel 文件批量导入商品数据</p>
      </div>

      <StepIndicator currentStep={currentStep} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && <UploadStep onUploadComplete={handleUploadComplete} />}
          {currentStep === 2 && taskId && (
            <ParsingStep taskId={taskId} onParsingComplete={handleParsingComplete} />
          )}
          {currentStep === 3 && taskId && (
            <PreviewStep taskId={taskId} onContinue={handlePreviewContinue} />
          )}
          {currentStep === 4 && taskId && (
            <SummaryStep
              taskId={taskId}
              onConfirm={handleConfirmImport}
              onCancel={handleCancel}
            />
          )}
          {currentStep === 5 && importResult && (
            <ResultStep result={importResult} onBackToList={handleBackToList} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
