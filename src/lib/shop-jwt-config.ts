function resolveShopSecret(): string {
  const shopSecret = process.env.SHOP_JWT_SECRET
  if (shopSecret) return shopSecret

  const fallback = process.env.JWT_SECRET
  if (fallback) return fallback

  throw new Error('SHOP_JWT_SECRET or JWT_SECRET environment variable must be set.')
}

export const SHOP_JWT_SECRET = new TextEncoder().encode(resolveShopSecret())
export const SHOP_COOKIE_NAME = 'celestia-shop-token'
export const SHOP_COOKIE_MAX_AGE = 7 * 24 * 60 * 60

/** 生产环境必须使用独立 SHOP_JWT_SECRET */
export function assertShopJwtConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.SHOP_JWT_SECRET) {
    throw new Error(
      'SHOP_JWT_SECRET is required in production. Set it in .env.production (must differ from JWT_SECRET).'
    )
  }
}
