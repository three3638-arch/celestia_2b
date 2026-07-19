/** 可单元测试的 middleware 路由守卫决策（与 src/middleware.ts 保持一致） */

export type ShopAdminRouteDecision = 'allow' | 'redirect-login' | 'redirect-panel'

export function resolveShopAdminRoute(
  pathname: string,
  authenticated: boolean
): ShopAdminRouteDecision {
  if (pathname === '/shop-admin/login') {
    return authenticated ? 'redirect-panel' : 'allow'
  }
  return authenticated ? 'allow' : 'redirect-login'
}

export type B2bAdminRouteDecision = 'allow' | 'redirect-login' | 'redirect-admin' | 'redirect-storefront'

export function resolveB2bAdminRoute(
  pathname: string,
  payload: { role: 'ADMIN' | 'CUSTOMER' } | null
): B2bAdminRouteDecision {
  if (pathname === '/admin/login') {
    if (payload?.role === 'ADMIN') return 'redirect-admin'
    return 'allow'
  }
  if (!payload) return 'redirect-login'
  if (payload.role !== 'ADMIN') return 'redirect-storefront'
  return 'allow'
}

export type ShopApiRouteDecision = 'allow' | 'unauthorized'

export function resolveShopAdminApiRoute(authenticated: boolean): ShopApiRouteDecision {
  return authenticated ? 'allow' : 'unauthorized'
}
