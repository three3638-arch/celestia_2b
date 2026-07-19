"use client";

import { Input } from "@/components/ui/input";
import { FormGroup } from "@/components/ui/form-group";
import { Button } from "@/components/ui/button";

export interface VariantFormData {
  id?: string;
  variantCode: string;
  nameZh?: string;
  nameEn?: string;
  nameAr?: string;
  listPrice: string;
  salePrice: string;
  saleStartAt: string;
  saleEndAt: string;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "PRE_ORDER";
}

export const emptyVariant = (): VariantFormData => ({
  variantCode: "",
  listPrice: "",
  salePrice: "",
  saleStartAt: "",
  saleEndAt: "",
  stockStatus: "IN_STOCK",
});

interface VariantPricingFormProps {
  variants: VariantFormData[];
  onChange: (variants: VariantFormData[]) => void;
}

export function VariantPricingForm({ variants, onChange }: VariantPricingFormProps) {
  const update = (index: number, patch: Partial<VariantFormData>) => {
    const next = variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const add = () => onChange([...variants, emptyVariant()]);
  const remove = (index: number) => onChange(variants.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {variants.map((v, index) => (
        <div key={v.id || index} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm">SKU #{index + 1}</h4>
            {variants.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                删除
              </Button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FormGroup label="Variant Code" required>
              <Input
                value={v.variantCode}
                onChange={(e) => update(index, { variantCode: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="中文名">
              <Input value={v.nameZh || ""} onChange={(e) => update(index, { nameZh: e.target.value })} />
            </FormGroup>
            <FormGroup label="英文名">
              <Input value={v.nameEn || ""} onChange={(e) => update(index, { nameEn: e.target.value })} />
            </FormGroup>
            <FormGroup label="阿拉伯文名">
              <Input value={v.nameAr || ""} onChange={(e) => update(index, { nameAr: e.target.value })} />
            </FormGroup>
            <FormGroup label="库存状态">
              <select
                value={v.stockStatus}
                onChange={(e) =>
                  update(index, { stockStatus: e.target.value as VariantFormData["stockStatus"] })
                }
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="IN_STOCK">有货</option>
                <option value="OUT_OF_STOCK">缺货</option>
                <option value="PRE_ORDER">预订</option>
              </select>
            </FormGroup>
            <FormGroup label="原价 (SAR)" required>
              <Input
                type="number"
                step="0.01"
                value={v.listPrice}
                onChange={(e) => update(index, { listPrice: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="折扣价 (可选)">
              <Input
                type="number"
                step="0.01"
                value={v.salePrice}
                onChange={(e) => update(index, { salePrice: e.target.value })}
              />
            </FormGroup>
            <FormGroup label="折扣开始">
              <Input
                type="datetime-local"
                value={v.saleStartAt}
                onChange={(e) => update(index, { saleStartAt: e.target.value })}
              />
            </FormGroup>
            <FormGroup label="折扣结束">
              <Input
                type="datetime-local"
                value={v.saleEndAt}
                onChange={(e) => update(index, { saleEndAt: e.target.value })}
              />
            </FormGroup>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add}>
        + 添加 SKU
      </Button>
    </div>
  );
}

export function variantsToPayload(variants: VariantFormData[]) {
  return variants.map((v) => ({
    ...(v.id ? { id: v.id } : {}),
    variantCode: v.variantCode,
    nameZh: v.nameZh,
    nameEn: v.nameEn,
    nameAr: v.nameAr,
    stockStatus: v.stockStatus,
    listPrice: parseFloat(v.listPrice),
    salePrice: v.salePrice ? parseFloat(v.salePrice) : null,
    saleStartAt: v.saleStartAt ? new Date(v.saleStartAt).toISOString() : null,
    saleEndAt: v.saleEndAt ? new Date(v.saleEndAt).toISOString() : null,
  }));
}
