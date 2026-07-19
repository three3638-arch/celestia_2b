import { NextRequest } from 'next/server'
import { locales, defaultLocale, type Locale } from '@/i18n/config'

export type SiteKind = 'marketing' | 'shop' | 'b2b' | 'local' | 'unknown'

const MARKETING_HOSTS = new Set(['celestia.com', 'www.celestia.com'])
const SHOP_HOSTS = new Set(['shop.celestia.com'])
const B2B_HOSTS = new Set(['products.celestia.com'])

export function getRequestHost(request: NextRequest): string {
  const raw = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  return raw.split(':')[0].toLowerCase()
}

export function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1'
}

export function getSiteKind(host: string): SiteKind {
  if (isLocalHost(host)) return 'local'
  if (MARKETING_HOSTS.has(host)) return 'marketing'
  if (SHOP_HOSTS.has(host)) return 'shop'
  if (B2B_HOSTS.has(host)) return 'b2b'
  return 'unknown'
}

/** 生产环境未知 Host 重定向至规范子域 */
export function resolveUnknownHostRedirect(pathname: string): string {
  const urls = getSiteUrls()
  if (pathname.startsWith('/admin')) {
    return buildExternalUrl(urls.b2b, pathname)
  }
  if (pathname.startsWith('/shop-admin')) {
    return buildExternalUrl(urls.shop, pathname)
  }
  if (pathname.match(/^\/[^/]+\/storefront/)) {
    return buildExternalUrl(urls.b2b, pathname)
  }
  if (pathname.match(/^\/[^/]+\/shop/)) {
    return buildExternalUrl(urls.shop, pathname.replace('/shop', ''))
  }
  return buildExternalUrl(urls.marketing, pathname)
}

export function getSiteUrls() {
  return {
    marketing: process.env.NEXT_PUBLIC_MARKETING_URL || 'http://localhost:3000',
    shop: process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3000',
    b2b: process.env.NEXT_PUBLIC_B2B_URL || 'http://localhost:3000',
  }
}

export function buildExternalUrl(base: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}${normalized}`
}

export function getShopPublicPath(locale: string, suffix = ''): string {
  const base = suffix ? `/${locale}${suffix}` : `/${locale}`
  return base
}

export function getShopInternalPath(locale: string, suffix = ''): string {
  if (!suffix || suffix === '/') return `/${locale}/shop`
  return `/${locale}/shop${suffix}`
}

function isLocaleSegment(segment: string): segment is Locale {
  return locales.includes(segment as Locale)
}

/** shop.celestia.com/en/products/foo → /en/shop/products/foo */
export function rewriteShopHostPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return `/${defaultLocale}/shop`
  }

  const [first, ...rest] = segments
  if (!isLocaleSegment(first)) return null

  if (rest.length === 0) {
    return `/${first}/shop`
  }

  if (rest[0] === 'shop') {
    return pathname
  }

  if (rest[0] === 'products' || rest[0] === 'inquiry') {
    return `/${first}/shop/${rest.join('/')}`
  }

  return null
}

export function isMarketingOnlyPath(pathname: string): boolean {
  if (pathname.startsWith('/admin') || pathname.startsWith('/shop-admin')) return true
  if (pathname.match(/^\/[^/]+\/storefront/)) return true
  if (pathname.match(/^\/[^/]+\/shop/)) return true
  return false
}

export function isShopPath(pathname: string): boolean {
  return !!pathname.match(/^\/[^/]+\/shop/)
}

export function isB2bOnlyPath(pathname: string): boolean {
  if (pathname.startsWith('/shop-admin')) return true
  if (isShopPath(pathname)) return true
  const localeOnly = pathname.match(/^\/([^/]+)$/)
  if (localeOnly && isLocaleSegment(localeOnly[1])) return true
  const marketingPages = ['about', 'services', 'contact']
  const m = pathname.match(/^\/([^/]+)\/([^/]+)/)
  if (m && isLocaleSegment(m[1]) && marketingPages.includes(m[2])) return true
  return false
}
