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
import { resetCustomerPassword } from '@/lib/actions/customer'
import { toast } from 'sonner'
import type { CustomerListItem } from '@/lib/actions/customer'

interface ResetPasswordDialogProps {
  customer: CustomerListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ResetPasswordDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 当对话框关闭时，清空输入
  useEffect(() => {
    if (!open) {
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!customer) return

    // 客户端验证
    if (newPassword.length < 6) {
      toast.error('密码长度至少6位')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setIsLoading(true)
    try {
      const result = await resetCustomerPassword({
        userId: customer.id,
        newPassword,
      })

      if (result.success) {
        toast.success(result.message || '密码重置成功')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error || '重置失败')
      }
    } catch {
      toast.error('重置过程中发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">重置客户密码</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            为该客户设置新密码，新密码将立即生效。
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
              <span className="text-sm text-muted-foreground">手机号</span>
              <span className="text-sm text-foreground">{customer.phone}</span>
            </div>
          </div>

          {/* 新密码输入 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-foreground">
              新密码
            </Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
              placeholder="请输入新密码（至少6位）"
            />
          </div>

          {/* 确认密码输入 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">
              确认密码
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
              placeholder="请再次输入新密码"
            />
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
            {isLoading ? '处理中...' : '确认重置'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
