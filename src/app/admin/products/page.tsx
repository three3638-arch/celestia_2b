"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  Plus,
  FileSpreadsheet,
  Search,
  Edit,
  Power,
  Trash2,
  ChevronLeft,
  ChevronRight,
  PackageX,
  Download,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { getAdminProducts, toggleProductStatus, deleteProduct } from "@/lib/actions/product";
import { getCategories } from "@/lib/actions/category";
import type { AdminProductListItem } from "@/lib/actions/product";
import type { Category } from "@prisma/client";

// 表格列定义
const columns: ColumnDef<AdminProductListItem>[] = [
  {
    accessorKey: "spuCode",
    header: "SPU编码",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.spuCode}</span>
    ),
  },
  {
    accessorKey: "nameZh",
    header: "商品名称",
    cell: ({ row }) => (
      <span className="max-w-[200px] truncate block" title={row.original.nameZh || row.original.spuCode || ""}>
        {row.original.nameZh || row.original.spuCode || "-"}
      </span>
    ),
  },
  {
    accessorKey: "supplier",
    header: "供应商",
    cell: ({ row }) => {
      const supplier = row.original.supplier;
      const supplierLink = row.original.supplierLink;
      if (!supplier) return "-";
      return (
        <div className="flex items-center gap-2">
          <span className="max-w-[150px] truncate" title={supplier}>
            {supplier}
          </span>
          {supplierLink && (
            <a
              href={supplierLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "categoryName",
    header: "品类",
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge
          variant={status === "ACTIVE" ? "default" : "secondary"}
          className={
            status === "ACTIVE"
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "bg-muted text-muted-foreground"
          }
        >
          {status === "ACTIVE" ? "上架" : "下架"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "skuCount",
    header: "SKU数量",
    cell: ({ row }) => (
      <span className="text-center">{row.original.skuCount}</span>
    ),
  },
  {
    accessorKey: "priceRange",
    header: "参考价区间(SAR)",
    cell: ({ row }) => {
      const min = row.original.minPriceSar;
      const max = row.original.maxPriceSar;
      if (!min && !max) return "-";
      if (min === max) return `SAR ${min}`;
      return `SAR ${min ?? "-"} - ${max ?? "-"}`;
    },
  },
  {
    accessorKey: "createdAt",
    header: "创建时间",
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      return date.toLocaleDateString("zh-CN");
    },
  },
  {
    id: "actions",
    header: "操作",
    cell: ({ row, table }) => {
      const product = row.original;
      const meta = table.options.meta as {
        onToggleStatus: (id: string) => void;
        onDelete: (id: string) => void;
      };

      return (
        <div className="flex items-center gap-2">
          <Link href={`/admin/products/${product.id}/edit`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${
              product.status === "ACTIVE"
                ? "text-green-400 hover:text-green-400 hover:bg-green-400/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => meta.onToggleStatus(product.id)}
            title={product.status === "ACTIVE" ? "下架" : "上架"}
          >
            <Power className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => meta.onDelete(product.id)}
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [categories, setCategories] = useState<Pick<Category, "id" | "nameZh">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 防抖搜索
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 加载品类列表
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    loadCategories();
  }, []);

  // 加载商品列表
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminProducts({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        categoryId: selectedCategory || undefined,
        status: selectedStatus || undefined,
      });
      setProducts(result.items);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      setError("加载商品列表失败，请重试");
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // 切换商品状态
  const handleToggleStatus = async (productId: string) => {
    try {
      const result = await toggleProductStatus(productId);
      if (result.success) {
        loadProducts();
      } else {
        setError(result.error || "操作失败");
      }
    } catch (err) {
      setError("操作失败，请重试");
      console.error("Failed to toggle status:", err);
    }
  };

  // 删除商品
  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleteLoading(true);
    try {
      const result = await deleteProduct(productToDelete);
      if (result.success) {
        setDeleteDialogOpen(false);
        setProductToDelete(null);
        loadProducts();
      } else {
        setError(result.error || "删除失败");
      }
    } catch (err) {
      setError("删除失败，请重试");
      console.error("Failed to delete product:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      onToggleStatus: handleToggleStatus,
      onDelete: handleDeleteClick,
    },
  });

  return (
    <>
      <div className="space-y-6">
        {/* 页面标题和操作按钮 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">商品管理</h2>
            <p className="text-muted-foreground mt-1">
              管理商品信息、SKU 配置和上下架状态
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/upload/template" download>
              <Button
                variant="outline"
                className="border-border hover:bg-card"
              >
                <Download className="h-4 w-4 mr-2" />
                下载模板
              </Button>
            </a>
            <Link href="/admin/products/import">
              <Button
                variant="outline"
                className="border-border hover:bg-card"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel 导入
              </Button>
            </Link>
            <Link href="/admin/products/new">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                新建商品
              </Button>
            </Link>
          </div>
        </div>

        {/* 错误提示 */}
        {error && <ErrorAlert message={error} />}

        {/* 筛选栏 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 SPU 编码或商品名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-3">
            <Select
              value={selectedCategory || undefined}
              onValueChange={(value) => {
                setSelectedCategory(value || "");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px] bg-card border-border">
                <SelectValue placeholder="全部品类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部品类</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nameZh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedStatus || undefined}
              onValueChange={(value) => {
                setSelectedStatus(value || "");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] bg-card border-border">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                <SelectItem value="ACTIVE">上架</SelectItem>
                <SelectItem value="INACTIVE">下架</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 数据表格 */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <PackageX className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">暂无商品</p>
              <p className="text-sm mt-1">
                {debouncedSearch || selectedCategory || selectedStatus
                  ? "尝试调整筛选条件"
                  : "点击「新建商品」按钮添加第一个商品"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="border-border hover:bg-transparent"
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className="text-muted-foreground font-medium"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-border hover:bg-muted/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  共 {total} 条记录
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    第 {page} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasMore}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认删除</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              此操作不可撤销。删除商品将同时删除其所有 SKU 和图片信息。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
