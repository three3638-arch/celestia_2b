'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCustomers, type CustomerListItem } from '@/lib/actions/customer'
import { ApproveCustomerDialog } from '@/components/admin/approve-customer-dialog'
import { UpdateMarkupDialog } from '@/components/admin/update-markup-dialog'
import { ResetPasswordDialog } from '@/components/admin/reset-password-dialog'
import { Search, ChevronLeft, ChevronRight, UserCheck, Edit3, Key } from 'lucide-react'
import { toast } from 'sonner'

// 状态筛选类型
type StatusFilter = 'all' | 'PENDING' | 'ACTIVE'

// 状态配置
const STATUS_CONFIG = {
  PENDING: { label: '待审核', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  ACTIVE: { label: '已激活', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 对话框状态
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [updateMarkupDialogOpen, setUpdateMarkupDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null)
  const [resetPasswordCustomer, setResetPasswordCustomer] = useState<CustomerListItem | null>(null)

  // 加载客户列表
  const loadCustomers = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getCustomers({
        page,
        pageSize,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
      })
      setCustomers(result.items)
      setTotal(result.total)
    } catch {
      toast.error('加载客户列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, status])

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    startTransition(() => {
      loadCustomers()
    })
  }, [loadCustomers])

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1)
      } else {
        loadCustomers()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // 处理状态筛选变化
  const handleStatusChange = (newStatus: StatusFilter) => {
    setStatus(newStatus)
    setPage(1)
  }

  // 打开审核对话框
  const handleApprove = (customer: CustomerListItem) => {
    setSelectedCustomer(customer)
    setApproveDialogOpen(true)
  }

  // 打开修改加价比例对话框
  const handleUpdateMarkup = (customer: CustomerListItem) => {
    setSelectedCustomer(customer)
    setUpdateMarkupDialogOpen(true)
  }

  // 打开重置密码对话框
  const handleResetPassword = (customer: CustomerListItem) => {
    setResetPasswordCustomer(customer)
    setResetPasswordDialogOpen(true)
  }

  // 操作成功后刷新列表
  const handleSuccess = () => {
    loadCustomers()
  }

  // 分页计算
  const totalPages = Math.ceil(total / pageSize)
  const hasPrevPage = page > 1
  const hasNextPage = page < totalPages

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <>
      <div className="space-y-6">
        {/* 顶部区域 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-foreground">客户管理</h2>
          
          {/* 搜索框 */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索手机号或姓名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-primary"
            />
          </div>
        </div>

        {/* 状态筛选 Tab */}
        <div className="flex gap-2">
          {([
            { key: 'all', label: '全部' },
            { key: 'PENDING', label: '待审核' },
            { key: 'ACTIVE', label: '已激活' },
          ] as const).map((item) => (
            <Button
              key={item.key}
              variant={status === item.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange(item.key)}
              className={
                status === item.key
                  ? 'bg-primary text-primary-foreground hover:bg-accent'
                  : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* 表格区域 */}
        <div className="rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">姓名</TableHead>
                <TableHead className="text-muted-foreground">手机号</TableHead>
                <TableHead className="text-muted-foreground">公司</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground">加价比例</TableHead>
                <TableHead className="text-muted-foreground">订单数</TableHead>
                <TableHead className="text-muted-foreground">注册时间</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isPending ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    暂无客户数据
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id} className="border-border hover:bg-card">
                    <TableCell className="text-foreground font-medium">
                      {customer.name}
                    </TableCell>
                    <TableCell className="text-foreground">{customer.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {customer.company || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_CONFIG[customer.status].color}
                      >
                        {STATUS_CONFIG[customer.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-primary">
                      ×{customer.markupRatio}
                    </TableCell>
                    <TableCell className="text-foreground">{customer.orderCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {customer.status === 'PENDING' ? (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(customer)}
                            className="bg-primary text-primary-foreground hover:bg-accent"
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            审核
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(customer)}
                            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Key className="h-4 w-4 mr-1" />
                            修改密码
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateMarkup(customer)}
                            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            修改加价
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(customer)}
                            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Key className="h-4 w-4 mr-1" />
                            修改密码
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              共 {total} 条记录，第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrevPage || isLoading}
                className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // 显示当前页附近的页码
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    disabled={isLoading}
                    className={
                      page === pageNum
                        ? 'bg-primary text-primary-foreground hover:bg-accent'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  >
                    {pageNum}
                  </Button>
                )
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!hasNextPage || isLoading}
                className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 审核对话框 */}
      <ApproveCustomerDialog
        customer={selectedCustomer}
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* 修改加价比例对话框 */}
      <UpdateMarkupDialog
        customer={selectedCustomer}
        open={updateMarkupDialogOpen}
        onOpenChange={setUpdateMarkupDialogOpen}
        onSuccess={handleSuccess}
      />

      {/* 重置密码对话框 */}
      <ResetPasswordDialog
        customer={resetPasswordCustomer}
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  )
}
