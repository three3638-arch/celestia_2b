/**
 * 2C 前台路径：生产 shop 子域使用短路径（/en/products），本地使用内部路径（/en/shop/products）
 */
export function useShopShortPaths(): boolean {
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || ''
  return shopUrl.length > 0 && !shopUrl.includes('localhost')
}

export function shopCatalogPath(locale: string): string {
  return useShopShortPaths() ? `/${locale}` : `/${locale}/shop`
}

export function shopProductPath(locale: string, slug: string): string {
  return useShopShortPaths()
    ? `/${locale}/products/${slug}`
    : `/${locale}/shop/products/${slug}`
}

export function shopInquiryPath(locale: string, query?: { productId: string; variantId?: string }): string {
  const base = useShopShortPaths() ? `/${locale}/inquiry` : `/${locale}/shop/inquiry`
  if (!query) return base
  const params = new URLSearchParams({ productId: query.productId })
  if (query.variantId) params.set('variantId', query.variantId)
  return `${base}?${params.toString()}`
}

/** 跨站外链（官网 → 商城） */
export function shopCatalogUrl(locale: string): string {
  const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || ''
  if (shopUrl && !shopUrl.includes('localhost')) {
    return `${shopUrl.replace(/\/$/, '')}/${locale}`
  }
  return `/${locale}/shop`
}
