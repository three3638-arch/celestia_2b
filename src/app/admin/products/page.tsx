"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import Image from "next/image";
import { toast } from "sonner";
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
  ImageIcon,
  Tag,
  ChevronDown,
  X,
  FolderOpen,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getAdminProducts, toggleProductStatus, deleteProduct } from "@/lib/actions/product";
import { getCategories } from "@/lib/actions/category";
import {
  getProductGroups,
  batchSetProductGroup,
  getOrCreateProductGroup,
} from "@/lib/actions/product-group";
import type { AdminProductListItem } from "@/lib/actions/product";
import type { Category } from "@prisma/client";

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [categories, setCategories] = useState<Pick<Category, "id" | "nameZh">[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // 批量选择
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 批量设置分组 Dialog
  const [batchGroupDialogOpen, setBatchGroupDialogOpen] = useState(false);
  const [batchGroupSearch, setBatchGroupSearch] = useState("");
  const [batchGroupSelectedId, setBatchGroupSelectedId] = useState<string | null>(null);
  const [batchGroupClear, setBatchGroupClear] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);

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

  // 加载分组列表
  useEffect(() => {
    async function loadGroups() {
      try {
        const data = await getProductGroups();
        setGroups(data);
      } catch (err) {
        console.error("Failed to load groups:", err);
      }
    }
    loadGroups();
  }, []);

  // 加载商品列表
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedProductIds([]); // 翻页或筛选时清空选择
    try {
      const result = await getAdminProducts({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        categoryId: selectedCategory || undefined,
        status: selectedStatus || undefined,
        groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
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
  }, [page, pageSize, debouncedSearch, selectedCategory, selectedStatus, selectedGroupIds]);

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

  // 批量选择逻辑
  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const togglePageSelection = () => {
    const pageIds = products.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedProductIds((prev) => {
        const newIds = new Set([...prev, ...pageIds]);
        return Array.from(newIds);
      });
    }
  };

  const isPageAllSelected =
    products.length > 0 && products.every((p) => selectedProductIds.includes(p.id));

  // 分组筛选相关
  const toggleGroupFilter = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId];
      return next;
    });
    setPage(1);
  };

  const clearGroupFilter = () => {
    setSelectedGroupIds([]);
    setPage(1);
  };

  // 批量设置分组
  const handleBatchSetGroup = async () => {
    if (selectedProductIds.length === 0) return;
    setBatchLoading(true);

    try {
      let targetGroupId: string | null = null;

      if (batchGroupClear) {
        targetGroupId = null;
      } else if (batchGroupSelectedId) {
        targetGroupId = batchGroupSelectedId;
      } else if (batchGroupSearch.trim()) {
        const result = await getOrCreateProductGroup(batchGroupSearch.trim());
        if (!result.success) {
          toast.error(result.error || "创建分组失败");
          setBatchLoading(false);
          return;
        }
        targetGroupId = result.data!.id;
        const groupsData = await getProductGroups();
        setGroups(groupsData);
      } else {
        toast.error("请选择或输入分组");
        setBatchLoading(false);
        return;
      }

      const result = await batchSetProductGroup(selectedProductIds, targetGroupId);
      if (result.success) {
        toast.success(result.message || "分组设置成功");
        setBatchGroupDialogOpen(false);
        setBatchGroupSearch("");
        setBatchGroupSelectedId(null);
        setBatchGroupClear(false);
        setSelectedProductIds([]);
        loadProducts();
      } else {
        toast.error(result.error || "设置分组失败");
      }
    } catch (err) {
      toast.error("设置分组时发生错误");
      console.error("Failed to batch set group:", err);
    } finally {
      setBatchLoading(false);
    }
  };

  // 列定义
  const columns = useMemo<ColumnDef<AdminProductListItem>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={isPageAllSelected}
            onCheckedChange={togglePageSelection}
            aria-label="全选本页"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedProductIds.includes(row.original.id)}
            onCheckedChange={() => toggleProductSelection(row.original.id)}
            aria-label={`选择 ${row.original.spuCode}`}
          />
        ),
        size: 40,
      },
      {
        accessorKey: "spuCode",
        header: "SPU编码",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.spuCode}</span>
        ),
      },
      {
        id: "primaryImage",
        header: "主图",
        cell: ({ row }) => {
          const url = row.original.primaryImageUrl;
          if (!url) {
            return (
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-muted-foreground">
                <ImageIcon className="h-5 w-5" />
              </div>
            );
          }
          return (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={url}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 object-cover"
                unoptimized
              />
            </div>
          );
        },
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
        id: "group",
        header: "分组",
        cell: ({ row }) => {
          const groupName = row.original.groupName;
          if (!groupName) {
            return (
              <span className="text-muted-foreground text-sm">无分组</span>
            );
          }
          return (
            <Badge variant="secondary" className="text-xs">
              {groupName}
            </Badge>
          );
        },
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
    ],
    [isPageAllSelected, selectedProductIds, products]
  );

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

  // Dialog 中可选的分组
  const dialogFilteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(batchGroupSearch.toLowerCase())
  );
  const showCreateOption =
    batchGroupSearch.trim().length > 0 &&
    !groups.some(
      (g) => g.name.toLowerCase() === batchGroupSearch.trim().toLowerCase()
    );

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
          <div className="flex gap-3 flex-wrap">
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

            {/* 分组多选筛选 */}
            <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-[180px] justify-between bg-card border-border"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Tag className="h-4 w-4 shrink-0" />
                      {selectedGroupIds.length === 0
                        ? "全部分组"
                        : `已选 ${selectedGroupIds.length} 个分组`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                }
              />
              <PopoverContent className="w-60 p-3" align="start">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground px-1">
                    选择分组
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedGroupIds.includes("ungrouped")}
                        onCheckedChange={() => toggleGroupFilter("ungrouped")}
                      />
                      <span className="text-sm">无分组</span>
                    </label>
                    {groups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={() => toggleGroupFilter(group.id)}
                        />
                        <span className="text-sm">{group.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedGroupIds.length > 0 && (
                    <div className="pt-1 border-t border-border">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="w-full text-muted-foreground hover:text-foreground"
                        onClick={clearGroupFilter}
                      >
                        <X className="h-3 w-3 mr-1" />
                        清除筛选
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedProductIds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border border-border rounded-lg">
            <span className="text-sm text-foreground">
              已选择 <strong>{selectedProductIds.length}</strong> 个商品
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => {
                setBatchGroupDialogOpen(true);
                setBatchGroupSearch("");
                setBatchGroupSelectedId(null);
                setBatchGroupClear(false);
              }}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              设置分组
            </Button>
          </div>
        )}

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
                {debouncedSearch || selectedCategory || selectedStatus || selectedGroupIds.length > 0
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

      {/* 批量设置分组 Dialog */}
      <Dialog open={batchGroupDialogOpen} onOpenChange={setBatchGroupDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">设置分组</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              为选中的 {selectedProductIds.length} 个商品设置分组
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Command className="rounded-lg border border-border">
              <CommandInput
                placeholder="搜索或输入新分组名称..."
                value={batchGroupSearch}
                onValueChange={setBatchGroupSearch}
              />
              <CommandList>
                <CommandEmpty>未找到分组</CommandEmpty>
                <CommandGroup heading="已有分组">
                  {dialogFilteredGroups.map((group) => (
                    <CommandItem
                      key={group.id}
                      onSelect={() => {
                        setBatchGroupSelectedId(group.id);
                        setBatchGroupClear(false);
                      }}
                      data-checked={batchGroupSelectedId === group.id}
                    >
                      {group.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {showCreateOption && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setBatchGroupSelectedId(null);
                          setBatchGroupClear(false);
                        }}
                        data-checked={!batchGroupSelectedId && !batchGroupClear && batchGroupSearch.trim().length > 0}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        创建新分组: {batchGroupSearch.trim()}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setBatchGroupSelectedId(null);
                      setBatchGroupClear(true);
                    }}
                    data-checked={batchGroupClear}
                  >
                    <X className="h-4 w-4 mr-2" />
                    清除分组
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>

            {/* 当前选择提示 */}
            <div className="mt-3 text-sm">
              {batchGroupClear ? (
                <span className="text-destructive">将清除所有选中商品的分组</span>
              ) : batchGroupSelectedId ? (
                <span className="text-muted-foreground">
                  已选择:{" "}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {groups.find((g) => g.id === batchGroupSelectedId)?.name}
                  </Badge>
                </span>
              ) : batchGroupSearch.trim() ? (
                <span className="text-muted-foreground">
                  将创建并设置为:{" "}
                  <Badge variant="secondary" className="text-xs ml-1">
                    {batchGroupSearch.trim()}
                  </Badge>
                </span>
              ) : (
                <span className="text-muted-foreground">请选择或输入分组</span>
              )}
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setBatchGroupDialogOpen(false)}
              disabled={batchLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchSetGroup}
              disabled={
                batchLoading ||
                (!batchGroupSelectedId && !batchGroupClear && !batchGroupSearch.trim())
              }
            >
              {batchLoading ? "保存中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
