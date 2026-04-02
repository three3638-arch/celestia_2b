'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
import { toggleFavorite } from '@/lib/actions/favorite'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface FavoriteButtonProps {
  productId: string
  initialFavorited: boolean
  className?: string
  onToggle?: (isFavorited: boolean) => void
}

export function FavoriteButton({
  productId,
  initialFavorited,
  className = '',
  onToggle,
}: FavoriteButtonProps) {
  const t = useTranslations('products')
  const [isPending, startTransition] = useTransition()
  const [isFavorited, setIsFavorited] = useState(initialFavorited)

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isPending) return

    // 乐观更新
    const newFavoritedState = !isFavorited
    setIsFavorited(newFavoritedState)

    startTransition(async () => {
      const result = await toggleFavorite(productId)

      if (result.success && result.data) {
        setIsFavorited(result.data.isFavorited)
        onToggle?.(result.data.isFavorited)
        toast.success(
          result.data.isFavorited ? t('favorited') : t('unfavorited')
        )
      } else {
        // 回滚乐观更新
        setIsFavorited(!newFavoritedState)
        toast.error(result.error || t('favoriteFailed'))
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-all duration-200 disabled:opacity-50 ${className}`}
      aria-label={isFavorited ? t('unfavorite') : t('favorite')}
    >
      <Heart
        className={`w-5 h-5 transition-colors duration-200 ${
          isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'
        }`}
      />
    </button>
  )
}
