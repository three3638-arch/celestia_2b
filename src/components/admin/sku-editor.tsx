"use client";

import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GemType, MetalColor, StockStatus } from "@prisma/client";

// SKU 项类型
export interface SkuItem {
  id?: string;
  gemType: GemType;
  metalColor: MetalColor;
  mainStoneSize?: string;
  size?: string;
  chainLength?: string;
  stockStatus: StockStatus;
  referencePriceSar?: string;
}

interface SkuEditorProps {
  skus: SkuItem[];
  onChange: (skus: SkuItem[]) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

const gemTypeOptions: { value: GemType; label: string }[] = [
  { value: "MOISSANITE", label: "莫桑石" },
  { value: "ZIRCON", label: "锆石" },
];

const metalColorOptions: { value: MetalColor; label: string }[] = [
  { value: "SILVER", label: "银色" },
  { value: "GOLD", label: "金色" },
  { value: "ROSE_GOLD", label: "玫瑰金" },
  { value: "OTHER", label: "其他" },
];

const stockStatusOptions: { value: StockStatus; label: string }[] = [
  { value: "IN_STOCK", label: "有货" },
  { value: "OUT_OF_STOCK", label: "缺货" },
  { value: "PRE_ORDER", label: "预订" },
];

export function SkuEditor({ skus, onChange, errors, disabled }: SkuEditorProps) {
  // 添加 SKU
  const addSku = () => {
    const newSku: SkuItem = {
      gemType: "MOISSANITE",
      metalColor: "SILVER",
      stockStatus: "IN_STOCK",
      referencePriceSar: "",
    };
    onChange([...skus, newSku]);
  };

  // 删除 SKU
  const removeSku = (index: number) => {
    if (skus.length <= 1) {
      return; // 至少保留一个 SKU
    }
    const newSkus = [...skus];
    newSkus.splice(index, 1);
    onChange(newSkus);
  };

  // 更新 SKU 字段
  const updateSku = (index: number, field: keyof SkuItem, value: string) => {
    const newSkus = [...skus];
    newSkus[index] = { ...newSkus[index], [field]: value };
    onChange(newSkus);
  };

  // 移动 SKU 位置
  const moveSku = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === skus.length - 1) return;

    const newSkus = [...skus];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newSkus[index], newSkus[targetIndex]] = [newSkus[targetIndex], newSkus[index]];
    onChange(newSkus);
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/30">
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                宝石类型
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                金属底色
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[120px]">
                主石尺寸(mm)
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                尺码
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                链长度
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[120px]">
                参考价(SAR)
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                库存状态
              </TableHead>
              <TableHead className="text-muted-foreground font-medium w-[100px]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skus.map((sku, index) => (
              <TableRow key={index} className="border-border hover:bg-muted/30">
                <TableCell className="py-3">
                  <Select
                    value={sku.gemType}
                    onValueChange={(value) =>
                      updateSku(index, "gemType", value as GemType)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={`h-9 bg-background border-border ${
                        errors?.[`sku.${index}.gemType`] ? "border-destructive" : ""
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gemTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <Select
                    value={sku.metalColor}
                    onValueChange={(value) =>
                      updateSku(index, "metalColor", value as MetalColor)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className={`h-9 bg-background border-border ${
                        errors?.[`sku.${index}.metalColor`]
                          ? "border-destructive"
                          : ""
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metalColorOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <Input
                    value={sku.mainStoneSize || ""}
                    onChange={(e) => updateSku(index, "mainStoneSize", e.target.value)}
                    placeholder="可选"
                    className="h-9 bg-background border-border"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Input
                    value={sku.size || ""}
                    onChange={(e) => updateSku(index, "size", e.target.value)}
                    placeholder="可选"
                    className="h-9 bg-background border-border"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Input
                    value={sku.chainLength || ""}
                    onChange={(e) =>
                      updateSku(index, "chainLength", e.target.value)
                    }
                    placeholder="可选"
                    className="h-9 bg-background border-border"
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sku.referencePriceSar || ""}
                    onChange={(e) =>
                      updateSku(index, "referencePriceSar", e.target.value)
                    }
                    placeholder="0.00"
                    className={`h-9 bg-background border-border ${
                      errors?.[`sku.${index}.referencePriceSar`]
                        ? "border-destructive"
                        : ""
                    }`}
                    disabled={disabled}
                  />
                </TableCell>
                <TableCell className="py-3">
                  <Select
                    value={sku.stockStatus}
                    onValueChange={(value) =>
                      updateSku(index, "stockStatus", value as StockStatus)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stockStatusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => moveSku(index, "up")}
                      disabled={index === 0 || disabled}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => moveSku(index, "down")}
                      disabled={index === skus.length - 1 || disabled}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeSku(index)}
                      disabled={skus.length <= 1 || disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 添加按钮 */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed border-border hover:bg-card"
        onClick={addSku}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-2" />
        添加 SKU
      </Button>

      {/* 错误提示 */}
      {errors?.skus && (
        <p className="text-sm text-destructive">{errors.skus}</p>
      )}
    </div>
  );
}
