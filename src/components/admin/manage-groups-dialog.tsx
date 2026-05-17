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
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { updateCustomerGroups } from '@/lib/actions/customer'
import { getProductGroups } from '@/lib/actions/product-group'
import { toast } from 'sonner'
import type { CustomerListItem } from '@/lib/actions/customer'

interface ManageGroupsDialogProps {
  customer: CustomerListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ManageGroupsDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: ManageGroupsDialogProps) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 当对话框打开时，加载分组并设置初始选中状态
  useEffect(() => {
    if (open && customer) {
      setSelectedGroupIds(customer.groups.map((g) => g.id))
      loadGroups()
    }
  }, [open, customer])

  const loadGroups = async () => {
    setGroupsLoading(true)
    try {
      const groups = await getProductGroups()
      setAllGroups(groups)
    } catch {
      toast.error('加载分组列表失败')
    } finally {
      setGroupsLoading(false)
    }
  }

  const handleGroupToggle = (groupId: string, checked: boolean) => {
    if (checked) {
      setSelectedGroupIds((prev) => [...prev, groupId])
    } else {
      setSelectedGroupIds((prev) => prev.filter((id) => id !== groupId))
    }
  }

  const handleSubmit = async () => {
    if (!customer) return

    setIsLoading(true)
    try {
      const result = await updateCustomerGroups(customer.id, selectedGroupIds)

      if (result.success) {
        toast.success(result.message || '分组权限已更新')
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
      <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">管理可见分组</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            管理该客户可见的商品分组。
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
              <span className="text-sm text-muted-foreground">当前可见分组</span>
              <span className="text-sm text-foreground">
                {customer.groups.length > 0 ? customer.groups.map((g) => g.name).join('、') : '无'}
              </span>
            </div>
          </div>

          {/* 分组列表 */}
          <div className="space-y-2">
            <Label className="text-foreground">可见分组</Label>
            <div className="space-y-2 rounded-lg bg-background p-4 max-h-48 overflow-y-auto">
              {groupsLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : allGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无分组</p>
              ) : (
                allGroups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`manage-group-${group.id}`}
                      checked={selectedGroupIds.includes(group.id)}
                      onCheckedChange={(checked) => handleGroupToggle(group.id, checked === true)}
                    />
                    <Label
                      htmlFor={`manage-group-${group.id}`}
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {group.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
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
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
