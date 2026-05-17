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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { batchSetCategory } from '@/lib/actions/product'
import { getCategories } from '@/lib/actions/category'
import { toast } from 'sonner'
import type { Category } from '@prisma/client'

interface BatchSetCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedProductIds: string[]
  onSuccess: () => void
}

export function BatchSetCategoryDialog({
  open,
  onOpenChange,
  selectedProductIds,
  onSuccess,
}: BatchSetCategoryDialogProps) {
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'nameZh'>[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  // 打开时加载品类列表
  useEffect(() => {
    if (open) {
      setSelectedCategoryId('')
      loadCategories()
    }
  }, [open])

  const loadCategories = async () => {
    setCategoriesLoading(true)
    try {
      const data = await getCategories()
      setCategories(data)
    } catch {
      toast.error('加载品类列表失败')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCategoryId) {
      toast.error('请选择品类')
      return
    }

    setIsLoading(true)
    try {
      const result = await batchSetCategory(selectedProductIds, selectedCategoryId)
      if (result.success) {
        toast.success(result.message || '品类设置成功')
        onOpenChange(false)
        onSuccess()
      } else {
        toast.error(result.error || '设置品类失败')
      }
    } catch {
      toast.error('设置品类时发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">设置品类</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            为选中的 {selectedProductIds.length} 个商品设置品类
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {categoriesLoading ? (
            <p className="text-sm text-muted-foreground">加载品类中...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无品类，请先创建品类</p>
          ) : (
            <Select value={selectedCategoryId || undefined} onValueChange={(value) => { if (value !== null) setSelectedCategoryId(value) }}>
              <SelectTrigger className="w-full bg-background border-border">
                <SelectValue placeholder="请选择品类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nameZh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedCategoryId}
          >
            {isLoading ? '保存中...' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
