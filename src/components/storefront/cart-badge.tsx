'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/stores/cart'
import { useTranslations } from 'next-intl'

interface CartBadgeProps {
  locale?: string
}

export function CartBadge({ locale = 'en' }: CartBadgeProps) {
  const [mounted, setMounted] = useState(false)
  const totalItems = useCartStore(state => state.totalItems())
  const t = useTranslations('nav')
  
  // 避免 hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])
  
  return (
    <Link href={`/${locale}/storefront/cart`} className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
      <ShoppingCart className="w-5 h-5" />
      {mounted && totalItems > 0 && (
        <span className="absolute top-1 end-1/4 bg-primary text-primary-foreground text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-medium">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
      <span className="text-[10px]">{t('cart')}</span>
    </Link>
  )
}
