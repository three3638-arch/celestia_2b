'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  getProductGroups,
  createProductGroup,
  updateProductGroup,
  deleteProductGroup,
  getUngroupedProductCount,
  assignUngroupedProducts,
  type ProductGroupItem,
} from '@/lib/actions/product-group'

export default function GroupsPage() {
  const [groups, setGroups] = useState<ProductGroupItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 新建分组
  const [newGroupName, setNewGroupName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // 重命名对话框
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameGroup, setRenameGroup] = useState<ProductGroupItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  // 删除对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteGroup, setDeleteGroup] = useState<ProductGroupItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 分配无分组商品
  const [ungroupedCount, setUngroupedCount] = useState(0)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing')
  const [assignGroupId, setAssignGroupId] = useState('')
  const [assignNewName, setAssignNewName] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  // 加载分组列表
  const loadGroups = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getProductGroups()
      setGroups(data)
    } catch {
      toast.error('加载分组列表失败')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 加载无分组商品数量
  const loadUngroupedCount = useCallback(async () => {
    try {
      const count = await getUngroupedProductCount()
      setUngroupedCount(count)
    } catch {
      // 静默失败
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      loadGroups()
      loadUngroupedCount()
    })
  }, [loadGroups, loadUngroupedCount])

  // 格式化日期
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // 新建分组
  const handleCreate = async () => {
    const trimmed = newGroupName.trim()
    if (!trimmed) {
      toast.error('请输入分组名称')
      return
    }
    setIsCreating(true)
    try {
      const result = await createProductGroup(trimmed)
      if (result.success) {
        toast.success('分组创建成功')
        setNewGroupName('')
        loadGroups()
      } else {
        toast.error(result.error || '创建失败')
      }
    } catch {
      toast.error('创建失败，请重试')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCreate()
    }
  }

  // 打开重命名对话框
  const handleOpenRename = (group: ProductGroupItem) => {
    setRenameGroup(group)
    setRenameValue(group.name)
    setRenameDialogOpen(true)
  }

  // 确认重命名
  const confirmRename = async () => {
    if (!renameGroup) return
    const trimmed = renameValue.trim()
    if (!trimmed) {
      toast.error('分组名称不能为空')
      return
    }
    setIsRenaming(true)
    try {
      const result = await updateProductGroup(renameGroup.id, trimmed)
      if (result.success) {
        toast.success('重命名成功')
        setRenameDialogOpen(false)
        setRenameGroup(null)
        loadGroups()
      } else {
        toast.error(result.error || '重命名失败')
      }
    } catch {
      toast.error('重命名失败，请重试')
    } finally {
      setIsRenaming(false)
    }
  }

  // 打开删除对话框
  const handleOpenDelete = (group: ProductGroupItem) => {
    setDeleteGroup(group)
    setDeleteDialogOpen(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!deleteGroup) return
    setIsDeleting(true)
    try {
      const result = await deleteProductGroup(deleteGroup.id)
      if (result.success) {
        toast.success('删除成功')
        setDeleteDialogOpen(false)
        setDeleteGroup(null)
        loadGroups()
        loadUngroupedCount()
      } else {
        toast.error(result.error || '删除失败')
      }
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  // 打开分配对话框
  const handleOpenAssign = () => {
    setAssignMode('existing')
    setAssignGroupId('')
    setAssignNewName('')
    setAssignDialogOpen(true)
  }

  // 确认分配
  const confirmAssign = async () => {
    if (assignMode === 'existing' && !assignGroupId) {
      toast.error('请选择一个分组')
      return
    }
    if (assignMode === 'new' && !assignNewName.trim()) {
      toast.error('请输入新分组名称')
      return
    }
    setIsAssigning(true)
    try {
      const result = await assignUngroupedProducts(
        assignMode === 'existing' ? assignGroupId : null,
        assignMode === 'new' ? assignNewName.trim() : undefined
      )
      if (result.success) {
        toast.success(result.message || '分配成功')
        setAssignDialogOpen(false)
        setAssignGroupId('')
        setAssignNewName('')
        loadGroups()
        loadUngroupedCount()
      } else {
        toast.error(result.error || '分配失败')
      }
    } catch {
      toast.error('分配失败，请重试')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* 页面标题和操作区 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">分组管理</h2>
            <p className="text-muted-foreground mt-1">
              管理商品分组，控制客户可见范围
            </p>
          </div>
        </div>

        {/* 新建分组 + 无分组商品提示 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                新建分组
              </label>
              <Input
                placeholder="输入分组名称"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                disabled={isCreating}
                className="w-64 bg-card border-border text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !newGroupName.trim()}
              className="bg-primary text-primary-foreground hover:bg-accent"
            >
              <Plus className="h-4 w-4 mr-1" />
              {isCreating ? '创建中...' : '新建分组'}
            </Button>
          </div>

          {ungroupedCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                无分组商品数量:{' '}
                <span className="font-medium text-foreground">{ungroupedCount}</span>
              </span>
              <Button
                variant="outline"
                onClick={handleOpenAssign}
                className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PackagePlus className="h-4 w-4 mr-1" />
                分配无分组商品
              </Button>
            </div>
          )}
        </div>

        {/* 数据表格 */}
        <div className="rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">分组名称</TableHead>
                <TableHead className="text-muted-foreground">商品数量</TableHead>
                <TableHead className="text-muted-foreground">创建时间</TableHead>
                <TableHead className="text-muted-foreground text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || isPending ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground"
                  >
                    加载中...
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FolderOpen className="h-8 w-8 opacity-50" />
                      <p>暂无分组</p>
                      <p className="text-sm">输入名称创建第一个分组</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow
                    key={group.id}
                    className="border-border hover:bg-card"
                  >
                    <TableCell className="text-foreground font-medium">
                      {group.name}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {group.productCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(group.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenRename(group)}
                          className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          重命名
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDelete(group)}
                          className="border-border bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">重命名分组</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              修改分组名称，所有客户的可见分组将同步更新。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename()
              }}
              placeholder="分组名称"
              className="bg-card border-border text-foreground"
            />
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              取消
            </Button>
            <Button
              onClick={confirmRename}
              disabled={isRenaming || !renameValue.trim()}
              className="bg-primary text-primary-foreground hover:bg-accent"
            >
              {isRenaming ? '保存中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认删除</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              删除后，该分组下的商品将变为无分组（所有客户不可见）。
              {deleteGroup && deleteGroup.productCount > 0 && (
                <span className="block mt-1">
                  该分组下共有{' '}
                  <span className="font-medium text-foreground">
                    {deleteGroup.productCount}
                  </span>{' '}
                  个商品。
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配无分组商品对话框 */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">分配无分组商品</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              将当前{' '}
              <span className="font-medium text-foreground">
                {ungroupedCount}
              </span>{' '}
              个无分组商品分配到指定分组。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={assignMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignMode('existing')}
                className={
                  assignMode === 'existing'
                    ? 'bg-primary text-primary-foreground hover:bg-accent'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              >
                添加到已有分组
              </Button>
              <Button
                variant={assignMode === 'new' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignMode('new')}
                className={
                  assignMode === 'new'
                    ? 'bg-primary text-primary-foreground hover:bg-accent'
                    : 'border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              >
                添加到新分组
              </Button>
            </div>

            {assignMode === 'existing' ? (
              <Select
                value={assignGroupId || undefined}
                onValueChange={(value) => setAssignGroupId(value || '')}
              >
                <SelectTrigger className="w-full bg-card border-border">
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="输入新分组名称"
                value={assignNewName}
                onChange={(e) => setAssignNewName(e.target.value)}
                className="bg-card border-border text-foreground"
              />
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isAssigning}
            >
              取消
            </Button>
            <Button
              onClick={confirmAssign}
              disabled={
                isAssigning ||
                (assignMode === 'existing' && !assignGroupId) ||
                (assignMode === 'new' && !assignNewName.trim())
              }
              className="bg-primary text-primary-foreground hover:bg-accent"
            >
              {isAssigning ? '分配中...' : '确认分配'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
