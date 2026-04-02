"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FormGroup } from "@/components/ui/form-group";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SkuEditor, type SkuItem } from "@/components/admin/sku-editor";
import { ImageUploader, type ImageItem } from "@/components/admin/image-uploader";
import { createProduct } from "@/lib/actions/product";
import { getCategories } from "@/lib/actions/category";
import type { Category, GemType, MetalColor } from "@prisma/client";

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

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Pick<Category, "id" | "nameZh">[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // 表单状态
  const [formData, setFormData] = useState({
    spuCode: "",
    categoryId: "",
    nameZh: "",
    nameEn: "",
    nameAr: "",
    descriptionZh: "",
    descriptionEn: "",
    descriptionAr: "",
    supplier: "",
    supplierLink: "",
    gemTypes: [] as GemType[],
    metalColors: [] as MetalColor[],
  });

  const [skus, setSkus] = useState<SkuItem[]>([
    {
      gemType: "MOISSANITE",
      metalColor: "SILVER",
      stockStatus: "IN_STOCK",
      referencePriceSar: "",
    },
  ]);

  const [images, setImages] = useState<ImageItem[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 加载品类列表
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories:", err);
        setError("加载品类列表失败");
      } finally {
        setCategoriesLoading(false);
      }
    }
    loadCategories();
  }, []);

  // 验证表单
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.spuCode.trim()) {
      errors.spuCode = "SPU 编码不能为空";
    }
    if (!formData.categoryId) {
      errors.categoryId = "请选择品类";
    }

    if (formData.gemTypes.length === 0) {
      errors.gemTypes = "请至少选择一种宝石类型";
    }
    if (formData.metalColors.length === 0) {
      errors.metalColors = "请至少选择一种金属底色";
    }
    if (skus.length === 0) {
      errors.skus = "请至少添加一个 SKU";
    }

    // 验证 SKU
    skus.forEach((sku, index) => {
      if (!sku.referencePriceSar || parseFloat(sku.referencePriceSar) <= 0) {
        errors[`sku.${index}.referencePriceSar`] = "请输入参考价";
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 准备图片数据
      const imageData = images.map((img, index) => ({
        url: img.url,
        thumbnailUrl: img.thumbnailUrl || img.url,
        isPrimary: img.isPrimary,
        sortOrder: index,
      }));

      // 准备 SKU 数据
      const skuData = skus.map((sku) => ({
        gemType: sku.gemType,
        metalColor: sku.metalColor,
        size: sku.size,
        chainLength: sku.chainLength,
        stockStatus: sku.stockStatus,
        referencePriceSar: sku.referencePriceSar,
      }));

      const result = await createProduct({
        spuCode: formData.spuCode,
        nameZh: formData.nameZh,
        nameEn: formData.nameEn || undefined,
        nameAr: formData.nameAr || undefined,
        descriptionZh: formData.descriptionZh || undefined,
        descriptionEn: formData.descriptionEn || undefined,
        descriptionAr: formData.descriptionAr || undefined,
        supplier: formData.supplier || undefined,
        supplierLink: formData.supplierLink || undefined,
        categoryId: formData.categoryId,
        gemTypes: formData.gemTypes,
        metalColors: formData.metalColors,
        skus: skuData,
        images: imageData.length > 0 ? imageData : undefined,
      });

      if (result.success) {
        router.push("/admin/products");
      } else {
        setError(result.error || "创建商品失败");
      }
    } catch (err) {
      console.error("Failed to create product:", err);
      setError("创建商品失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 切换宝石类型选择
  const toggleGemType = (value: GemType) => {
    setFormData((prev) => {
      const current = prev.gemTypes;
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, gemTypes: updated };
    });
  };

  // 切换金属底色选择
  const toggleMetalColor = (value: MetalColor) => {
    setFormData((prev) => {
      const current = prev.metalColors;
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, metalColors: updated };
    });
  };

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
        {/* 页面标题 */}
        <div className="flex items-center gap-4">
          <Link href="/admin/products">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-semibold text-foreground">新建商品</h2>
            <p className="text-muted-foreground mt-1">
              填写商品基本信息、配置 SKU 和上传图片
            </p>
          </div>
        </div>

        {/* 错误提示 */}
        {error && <ErrorAlert message={error} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 区域一：基本信息 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SPU 编码 */}
                  <FormGroup
                    label="SPU 编码"
                    htmlFor="spuCode"
                    error={formErrors.spuCode}
                    required
                  >
                    <Input
                      id="spuCode"
                      value={formData.spuCode}
                      onChange={(e) =>
                        setFormData({ ...formData, spuCode: e.target.value })
                      }
                      placeholder="请输入 SPU 编码"
                      className="bg-background border-border"
                    />
                  </FormGroup>

                  {/* 品类 */}
                  <FormGroup
                    label="品类"
                    htmlFor="categoryId"
                    error={formErrors.categoryId}
                    required
                  >
                    <Select
                      value={formData.categoryId || undefined}
                      onValueChange={(value) =>
                        setFormData({ ...formData, categoryId: value || "" })
                      }
                    >
                      <SelectTrigger
                        id="categoryId"
                        className={`bg-background border-border ${
                          formErrors.categoryId ? "border-destructive" : ""
                        }`}
                      >
                        <SelectValue placeholder="选择品类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nameZh}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormGroup>
                </div>

                {/* 商品名称 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormGroup
                    label="商品名称 - 中文"
                    htmlFor="nameZh"
                    error={formErrors.nameZh}
                  >
                    <Input
                      id="nameZh"
                      value={formData.nameZh}
                      onChange={(e) =>
                        setFormData({ ...formData, nameZh: e.target.value })
                      }
                      placeholder="请输入中文名称"
                      className="bg-background border-border"
                    />
                  </FormGroup>

                  <FormGroup
                    label="商品名称 - 英文"
                    htmlFor="nameEn"
                  >
                    <Input
                      id="nameEn"
                      value={formData.nameEn}
                      onChange={(e) =>
                        setFormData({ ...formData, nameEn: e.target.value })
                      }
                      placeholder="可选"
                      className="bg-background border-border"
                    />
                  </FormGroup>

                  <FormGroup
                    label="商品名称 - 阿拉伯文"
                    htmlFor="nameAr"
                  >
                    <Input
                      id="nameAr"
                      value={formData.nameAr}
                      onChange={(e) =>
                        setFormData({ ...formData, nameAr: e.target.value })
                      }
                      placeholder="可选"
                      className="bg-background border-border"
                      dir="rtl"
                    />
                  </FormGroup>
                </div>

                {/* 描述 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormGroup label="描述 - 中文" htmlFor="descriptionZh">
                    <Textarea
                      id="descriptionZh"
                      value={formData.descriptionZh}
                      onChange={(e) =>
                        setFormData({ ...formData, descriptionZh: e.target.value })
                      }
                      placeholder="可选"
                      className="bg-background border-border min-h-[100px]"
                    />
                  </FormGroup>

                  <FormGroup label="描述 - 英文" htmlFor="descriptionEn">
                    <Textarea
                      id="descriptionEn"
                      value={formData.descriptionEn}
                      onChange={(e) =>
                        setFormData({ ...formData, descriptionEn: e.target.value })
                      }
                      placeholder="可选"
                      className="bg-background border-border min-h-[100px]"
                    />
                  </FormGroup>

                  <FormGroup label="描述 - 阿拉伯文" htmlFor="descriptionAr">
                    <Textarea
                      id="descriptionAr"
                      value={formData.descriptionAr}
                      onChange={(e) =>
                        setFormData({ ...formData, descriptionAr: e.target.value })
                      }
                      placeholder="可选"
                      className="bg-background border-border min-h-[100px]"
                      dir="rtl"
                    />
                  </FormGroup>
                </div>

                {/* 供应商信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormGroup label="供应商" htmlFor="supplier">
                    <Input
                      id="supplier"
                      value={formData.supplier}
                      onChange={(e) =>
                        setFormData({ ...formData, supplier: e.target.value })
                      }
                      placeholder="如: 宝石供应商A"
                      className="bg-background border-border"
                    />
                  </FormGroup>

                  <FormGroup label="供应商链接" htmlFor="supplierLink">
                    <Input
                      id="supplierLink"
                      type="url"
                      value={formData.supplierLink}
                      onChange={(e) =>
                        setFormData({ ...formData, supplierLink: e.target.value })
                      }
                      placeholder="如: https://supplier.example.com"
                      className="bg-background border-border"
                    />
                  </FormGroup>
                </div>

                {/* 宝石类型 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    宝石类型 <span className="text-destructive">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {gemTypeOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={formData.gemTypes.includes(opt.value)}
                          onCheckedChange={() => toggleGemType(opt.value)}
                        />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {formErrors.gemTypes && (
                    <p className="text-sm text-destructive mt-2">
                      {formErrors.gemTypes}
                    </p>
                  )}
                </div>

                {/* 金属底色 */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    金属底色 <span className="text-destructive">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {metalColorOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={formData.metalColors.includes(opt.value)}
                          onCheckedChange={() => toggleMetalColor(opt.value)}
                        />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {formErrors.metalColors && (
                    <p className="text-sm text-destructive mt-2">
                      {formErrors.metalColors}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 区域二：SKU 配置 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">SKU 配置</CardTitle>
              </CardHeader>
              <CardContent>
                <SkuEditor
                  skus={skus}
                  onChange={setSkus}
                  errors={formErrors}
                  disabled={loading}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* 区域三：商品图片 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">商品图片</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  maxImages={10}
                  disabled={loading}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* 底部操作栏 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex items-center justify-end gap-4 pt-4 border-t border-border"
          >
            <Button
              type="button"
              variant="outline"
              className="border-border hover:bg-card"
              onClick={() => router.push("/admin/products")}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner className="h-4 w-4 mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  保存商品
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </div>
  );
}
