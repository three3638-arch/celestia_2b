'use client'

import { useState, useEffect } from 'react'
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
import { updateMarkupRatio } from '@/lib/actions/customer'
import { toast } from 'sonner'
import type { CustomerListItem } from '@/lib/actions/customer'

interface UpdateMarkupDialogProps {
  customer: CustomerListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UpdateMarkupDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: UpdateMarkupDialogProps) {
  const [newMarkupRatio, setNewMarkupRatio] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // 当对话框打开时，设置默认值
  useEffect(() => {
    if (open && customer) {
      setNewMarkupRatio(customer.markupRatio)
    }
  }, [open, customer])

  const handleSubmit = async () => {
    if (!customer) return

    const ratio = parseFloat(newMarkupRatio)
    if (isNaN(ratio) || ratio <= 0) {
      toast.error('加价比例必须大于0')
      return
    }

    setIsLoading(true)
    try {
      const result = await updateMarkupRatio({
        userId: customer.id,
        markupRatio: ratio,
      })

      if (result.success) {
        toast.success(result.message || '加价比例更新成功')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error || '更新失败')
      }
    } catch {
      toast.error('更新过程中发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">修改加价比例</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            修改该客户的加价比例，新比例将应用于后续订单。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 客户信息 */}
          <div className="space-y-3 rounded-lg bg-background p-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">客户姓名</span>
              <span className="text-sm text-foreground">{customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">当前加价比例</span>
              <span className="text-sm text-primary">×{customer.markupRatio}</span>
            </div>
          </div>

          {/* 新加价比例输入 */}
          <div className="space-y-2">
            <Label htmlFor="newMarkupRatio" className="text-foreground">
              新加价比例
            </Label>
            <Input
              id="newMarkupRatio"
              type="number"
              step="0.01"
              min="0.01"
              value={newMarkupRatio}
              onChange={(e) => setNewMarkupRatio(e.target.value)}
              className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
              placeholder="请输入新的加价比例"
            />
            <p className="text-xs text-muted-foreground">
              新加价比例将应用于该客户的后续订单报价。
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
            {isLoading ? '处理中...' : '确认修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
