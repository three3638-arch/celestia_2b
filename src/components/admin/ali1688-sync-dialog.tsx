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
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { syncProductsFrom1688 } from '@/lib/actions/ali1688-import'
import { toast } from 'sonner'
import type { Sync1688Result } from '@/lib/actions/ali1688-import'

interface Ali1688SyncDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type SyncStep = 'input' | 'loading' | 'result'

export function Ali1688SyncDialog({
  open,
  onOpenChange,
  onSuccess,
}: Ali1688SyncDialogProps) {
  const [sellerOpenId, setSellerOpenId] = useState('')
  const [exchangeRate, setExchangeRate] = useState('0.5814')
  const [step, setStep] = useState<SyncStep>('input')
  const [result, setResult] = useState<Sync1688Result | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('input')
      setResult(null)
      setSellerOpenId('')
      setExchangeRate('0.5814')
    }
    onOpenChange(newOpen)
  }

  const handleSync = async () => {
    if (!sellerOpenId.trim()) {
      toast.error('请输入供应商ID')
      return
    }

    const rate = parseFloat(exchangeRate)
    if (isNaN(rate) || rate <= 0) {
      toast.error('汇率必须大于0')
      return
    }

    setStep('loading')

    try {
      const syncResult = await syncProductsFrom1688({
        sellerOpenId: sellerOpenId.trim(),
        exchangeRate: rate,
      })

      setResult(syncResult)
      setStep('result')

      if (syncResult.success) {
        onSuccess()
      }
    } catch {
      setResult({ success: false, error: '同步过程中发生错误' })
      setStep('result')
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
        {step === 'input' && (
          <>
            <DialogHeader>
              <DialogTitle>1688同步商品</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                将同步该供应商商品的价格，并自动下架1688已下架的商品
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sellerOpenId" className="text-foreground">
                  供应商ID
                </Label>
                <Input
                  id="sellerOpenId"
                  value={sellerOpenId}
                  onChange={(e) => setSellerOpenId(e.target.value)}
                  className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
                  placeholder="请输入1688供应商OpenID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exchangeRate" className="text-foreground">
                  现行汇率
                </Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="bg-background border-border text-foreground focus:border-primary focus:ring-primary"
                  placeholder="0.5814"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                说明：将同步该供应商商品的价格，并自动下架1688已下架的商品
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                取消
              </Button>
              <Button
                onClick={handleSync}
                className="bg-primary text-primary-foreground hover:bg-accent"
              >
                开始同步
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground">正在同步商品数据...</p>
          </div>
        )}

        {step === 'result' && (
          <>
            <DialogHeader>
              <DialogTitle>
                {result?.success ? '同步完成' : '同步失败'}
              </DialogTitle>
            </DialogHeader>

            {result?.success && result.stats ? (
              <div className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  该供应商共 <span className="font-medium text-foreground">{result.stats.totalProducts}</span> 个商品
                </p>

                <div className="space-y-2 rounded-lg bg-background p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✓</span>
                    <span className="text-sm text-foreground">
                      价格更新: <span className="font-medium">{result.stats.updatedProducts}</span> 个商品,{' '}
                      <span className="font-medium">{result.stats.updatedSkus}</span> 个SKU
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-600">✓</span>
                    <span className="text-sm text-foreground">
                      已下架: <span className="font-medium">{result.stats.delistedProducts}</span> 个商品
                    </span>
                  </div>

                  {result.stats.delistedSkus > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-600">!</span>
                      <span className="text-sm text-foreground">
                        SKU缺货: <span className="font-medium">{result.stats.delistedSkus}</span> 个
                      </span>
                    </div>
                  )}

                  {result.stats.failedProducts > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600">✗</span>
                      <span className="text-sm text-foreground">
                        处理失败: <span className="font-medium text-red-600">{result.stats.failedProducts}</span> 个
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-sm text-red-600">
                  {result?.error || '同步过程中发生未知错误'}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={handleClose}
                className="bg-primary text-primary-foreground hover:bg-accent"
              >
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
