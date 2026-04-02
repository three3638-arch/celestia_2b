"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
  Search,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  PackageX,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getAdminOrders, deleteOrder } from "@/lib/actions/order";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// 订单列表项类型
interface OrderListItem {
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  status: string;
  statusLabel: string;
  itemCount: number;
  totalCny: string | null;
  totalSar: string | null;
  estimatedProfit: string | null;
  createdAt: Date;
}

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

// 状态 Tab 列表
const statusTabs = [
  { key: "", label: "全部" },
  { key: "PENDING_QUOTE", label: "待报价" },
  { key: "QUOTED", label: "已报价" },
  { key: "NEGOTIATING", label: "协商中" },
  { key: "CONFIRMED", label: "已确认" },
  { key: "PARTIALLY_PAID", label: "部分付款" },
  { key: "FULLY_PAID", label: "已付清" },
  { key: "SHIPPED", label: "已发货" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CANCELLED", label: "已取消" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [orderNoSearch, setOrderNoSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // 删除相关状态
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 防抖搜索
  const [debouncedOrderNo, setDebouncedOrderNo] = useState("");
  const [debouncedCustomer, setDebouncedCustomer] = useState("");

  // 表格列定义（移到组件内部以便访问删除状态）
  const columns: ColumnDef<OrderListItem>[] = [
    {
      accessorKey: "orderNo",
      header: "订单号",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-foreground">{row.original.orderNo}</span>
      ),
    },
    {
      accessorKey: "customer",
      header: "客户",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-foreground">{row.original.customerName}</div>
          <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "状态",
      cell: ({ row }) => {
        const status = row.original.status;
        const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG];
        const colorClass = config ? statusColorMap[config.color] : statusColorMap.blue;
        return (
          <Badge variant="outline" className={colorClass}>
            {row.original.statusLabel}
          </Badge>
        );
      },
    },
    {
      accessorKey: "itemCount",
      header: "商品数",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.itemCount}</span>
      ),
    },
    {
      accessorKey: "totalCny",
      header: "成本(CNY)",
      cell: ({ row }) => {
        const total = row.original.totalCny;
        return (
          <span className="text-sm text-foreground">
            {total ? `¥${total}` : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "totalSar",
      header: "客户价(SAR)",
      cell: ({ row }) => {
        const total = row.original.totalSar;
        return (
          <span className="text-sm text-foreground">
            {total ? `SAR ${total}` : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "estimatedProfit",
      header: "预估毛利",
      cell: ({ row }) => {
        const profit = row.original.estimatedProfit;
        if (!profit) return <span className="text-sm text-muted-foreground">-</span>;
        const profitNum = parseFloat(profit);
        const isPositive = profitNum >= 0;
        return (
          <span className={`text-sm font-medium ${isPositive ? "text-green-400" : "text-red-400"}`}>
            {isPositive ? "+" : ""}¥{profit}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "创建时间",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt, "zh")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => {
        const order = row.original;
        const isPendingQuote = order.status === "PENDING_QUOTE";
        const isCancelled = order.status === "CANCELLED";

        return (
          <div className="flex items-center gap-2">
            {isPendingQuote ? (
              <Link href={`/admin/orders/${order.id}/quote`}>
                <Button
                  size="sm"
                  className="h-8 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-black font-medium"
                >
                  <Tag className="h-3.5 w-3.5 mr-1" />
                  报价
                </Button>
              </Link>
            ) : (
              <Link href={`/admin/orders/${order.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-border hover:bg-card"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  查看
                </Button>
              </Link>
            )}
            {isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-red-500/50 text-red-400 hover:bg-red-500/10"
                onClick={() => setDeleteOrderId(order.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                删除
              </Button>
            )}
          </div>
        );
      },
    },
  ];
  
  // 删除订单处理
  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteOrder(deleteOrderId);
      if (result.success) {
        toast.success("订单已删除");
        setDeleteOrderId(null);
        loadOrders();
      } else {
        toast.error(result.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrderNo(orderNoSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [orderNoSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomer(customerSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // 加载订单列表
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminOrders({
        page,
        pageSize,
        status: activeTab || undefined,
        keyword: debouncedOrderNo || undefined,
      });

      if (result.success && result.data) {
        let filteredOrders = result.data.items;

        // 客户端筛选客户（按姓名或手机号）
        if (debouncedCustomer) {
          const keyword = debouncedCustomer.toLowerCase();
          filteredOrders = filteredOrders.filter(
            (order) =>
              order.customerName.toLowerCase().includes(keyword) ||
              order.customerPhone.includes(keyword)
          );
        }

        setOrders(filteredOrders);
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      } else {
        setError(result.error || "加载订单列表失败");
      }
    } catch (err) {
      setError("加载订单列表失败，请重试");
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeTab, debouncedOrderNo, debouncedCustomer]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Fragment>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h2 className="text-2xl font-semibold text-foreground">订单管理</h2>
          <p className="text-muted-foreground mt-1">
            管理客户订单、报价、付款和物流信息
          </p>
        </div>

        {/* 错误提示 */}
        {error && <ErrorAlert message={error} />}

        {/* 状态 Tab 筛选 */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "border-border hover:bg-card"
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* 搜索栏 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-xs">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索订单号..."
              value={orderNoSearch}
              onChange={(e) => setOrderNoSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索客户姓名或手机号..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>

        {/* 数据表格 */}
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner className="h-8 w-8" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <PackageX className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">暂无订单</p>
              <p className="text-sm mt-1">
                {activeTab || debouncedOrderNo || debouncedCustomer
                  ? "尝试调整筛选条件"
                  : "暂无订单数据"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      className="border-border hover:bg-transparent bg-muted/30"
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
      <Dialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <DialogContent>
          <DialogTitle>删除订单</DialogTitle>
          <DialogDescription>
            确定要删除此订单吗？此操作不可恢复。
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOrderId(null)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={isDeleting}
            >
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
