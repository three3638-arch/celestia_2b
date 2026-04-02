'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { approveCustomer } from '@/lib/actions/customer'
import { DEFAULT_MARKUP_RATIO } from '@/lib/constants'
import { toast } from 'sonner'
import type { CustomerListItem } from '@/lib/actions/customer'

interface ApproveCustomerDialogProps {
  customer: CustomerListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ApproveCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: ApproveCustomerDialogProps) {
  const [markupRatio, setMarkupRatio] = useState<string>(DEFAULT_MARKUP_RATIO.toString())
  const [isLoading, setIsLoading] = useState(false)

  // 当对话框打开时，重置加价比例
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && customer) {
      setMarkupRatio(DEFAULT_MARKUP_RATIO.toString())
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async () => {
    if (!customer) return

    const ratio = parseFloat(markupRatio)
    if (isNaN(ratio) || ratio <= 0) {
      toast.error('加价比例必须大于0')
      return
    }

    setIsLoading(true)
    try {
      const result = await approveCustomer({
        userId: customer.id,
        markupRatio: ratio,
      })

      if (result.success) {
        toast.success(result.message || '客户审核通过')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error || '审核失败')
      }
    } catch {
      toast.error('审核过程中发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">审核客户</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            审核通过后，客户将可以正常下单。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 客户信息 */}
          <div className="space-y-3 rounded-lg bg-background p-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">姓名</span>
              <span className="text-sm text-foreground">{customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">手机号</span>
              <span className="text-sm text-foreground">{customer.phone}</span>
            </div>
            {customer.company && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">公司</span>
                <span className="text-sm text-foreground">{customer.company}</span>
              </div>
            )}
          </div>

          {/* 加价比例输入 */}
          <div className="space-y-2">
            <Label htmlFor="markupRatio" className="text-foreground">
              加价比例
            </Label>
            <Input
              id="markupRatio"
              type="number"
              step="0.01"
              min="0.01"
              value={markupRatio}
              onChange={(e) => setMarkupRatio(e.target.value)}
              className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
              placeholder="请输入加价比例"
            />
            <p className="text-xs text-muted-foreground">
              加价比例将应用于该客户的所有订单报价。例如 1.15 表示在成本价基础上加价 15%。
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-primary text-primary-foreground hover:bg-accent"
          >
            {isLoading ? '处理中...' : '通过审核'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
