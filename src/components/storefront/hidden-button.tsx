'use client'

import { useState, useTransition } from 'react'
import { EyeOff } from 'lucide-react'
import { toggleHidden } from '@/lib/actions/hidden'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface HiddenButtonProps {
  productId: string
  onHidden: () => void
  className?: string
}

export function HiddenButton({
  productId,
  onHidden,
  className = '',
}: HiddenButtonProps) {
  const t = useTranslations('products')
  const [isPending, startTransition] = useTransition()
  const [isHidden, setIsHidden] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isPending) return

    startTransition(async () => {
      const result = await toggleHidden(productId)

      if (result.success && result.data) {
        setIsHidden(result.data.isHidden)
        if (result.data.isHidden) {
          toast.success(t('hiddenSuccess'))
          onHidden()
        } else {
          toast.success(t('unhiddenSuccess'))
        }
      } else {
        toast.error(result.error || t('hideFailed'))
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-all duration-200 disabled:opacity-50 ${className}`}
      aria-label={t('hideProduct')}
    >
      <EyeOff
        className={`w-5 h-5 transition-colors duration-200 ${
          isHidden ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        }`}
      />
    </button>
  )
}
