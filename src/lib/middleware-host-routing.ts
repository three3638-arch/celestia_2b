import { defaultLocale } from '@/i18n/config'
import {
  buildExternalUrl,
  getSiteKind,
  getSiteUrls,
  isB2bOnlyPath,
  isLocalHost,
  isShopPath,
  rewriteShopHostPath,
  resolveUnknownHostRedirect,
} from '@/lib/host-routing'

export type HostRoutingDecision =
  | { kind: 'pass' }
  | { kind: 'redirect'; url: string }
  | { kind: 'rewrite'; pathname: string }

/**
 * 纯函数：根据 Host + pathname 决定分流动作（供 middleware 与集成测试共用）
 */
export function resolveHostRoutingDecision(
  host: string,
  pathname: string,
  options?: { isProduction?: boolean }
): HostRoutingDecision {
  const isProduction = options?.isProduction ?? process.env.NODE_ENV === 'production'

  if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) {
    return { kind: 'pass' }
  }

  if (pathname === '/') {
    const siteKind = getSiteKind(host)
    if (siteKind === 'shop') {
      return { kind: 'redirect', url: `/${defaultLocale}` }
    }
    if (siteKind === 'b2b') {
      return { kind: 'redirect', url: `/${defaultLocale}/storefront` }
    }
    return { kind: 'redirect', url: `/${defaultLocale}` }
  }

  if (isLocalHost(host)) {
    return { kind: 'pass' }
  }

  const siteKind = getSiteKind(host)
  const urls = getSiteUrls()

  if (siteKind === 'unknown') {
    if (isProduction) {
      return { kind: 'redirect', url: resolveUnknownHostRedirect(pathname) }
    }
    return { kind: 'pass' }
  }

  if (siteKind === 'shop') {
    const rewritten = rewriteShopHostPath(pathname)
    if (rewritten && rewritten !== pathname) {
      return { kind: 'rewrite', pathname: rewritten }
    }
    return { kind: 'pass' }
  }

  if (siteKind === 'marketing') {
    if (pathname.startsWith('/admin')) {
      return { kind: 'redirect', url: buildExternalUrl(urls.b2b, pathname) }
    }
    if (pathname.startsWith('/shop-admin')) {
      return { kind: 'redirect', url: buildExternalUrl(urls.shop, pathname) }
    }
    if (pathname.match(/^\/[^/]+\/storefront/)) {
      return { kind: 'redirect', url: buildExternalUrl(urls.b2b, pathname) }
    }
    if (pathname.match(/^\/[^/]+\/shop/)) {
      const external = pathname.replace('/shop', '')
      return { kind: 'redirect', url: buildExternalUrl(urls.shop, external) }
    }
    return { kind: 'pass' }
  }

  if (siteKind === 'b2b') {
    if (pathname.startsWith('/shop-admin')) {
      return { kind: 'redirect', url: buildExternalUrl(urls.shop, pathname) }
    }
    if (isShopPath(pathname)) {
      return { kind: 'redirect', url: buildExternalUrl(urls.shop, pathname.replace('/shop', '')) }
    }
    if (isB2bOnlyPath(pathname) && !pathname.match(/^\/[^/]+\/storefront/) && !pathname.startsWith('/admin')) {
      return { kind: 'redirect', url: buildExternalUrl(urls.marketing, pathname) }
    }
    return { kind: 'pass' }
  }

  return { kind: 'pass' }
}
