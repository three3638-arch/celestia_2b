import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { JWT_SECRET, COOKIE_NAME } from './lib/jwt-config'
import { SHOP_JWT_SECRET, SHOP_COOKIE_NAME } from './lib/shop-jwt-config'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n/config'
import {
  getRequestHost,
} from './lib/host-routing'
import { resolveHostRoutingDecision } from './lib/middleware-host-routing'
import {
  resolveB2bAdminRoute,
  resolveShopAdminApiRoute,
  resolveShopAdminRoute,
} from './lib/middleware-guards'

const AUTH_PAGES = ['/login', '/register']

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

function buildRedirectUrl(path: string, request: NextRequest, baseOverride?: string): URL {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const base = baseOverride ?? `${protocol}://${host}`
  return new URL(path, base)
}

async function verifyB2bToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; role: 'ADMIN' | 'CUSTOMER'; status: 'PENDING' | 'ACTIVE' }
  } catch {
    return null
  }
}

async function verifyShopToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SHOP_JWT_SECRET)
    return payload as { shopUserId: string; role: 'SHOP_ADMIN' | 'SHOP_EDITOR' }
  } catch {
    return null
  }
}

function handleHostRouting(request: NextRequest): NextResponse | null {
  const host = getRequestHost(request)
  const { pathname } = request.nextUrl
  const decision = resolveHostRoutingDecision(host, pathname)

  if (decision.kind === 'redirect') {
    if (decision.url.startsWith('http')) {
      return NextResponse.redirect(decision.url)
    }
    return NextResponse.redirect(buildRedirectUrl(decision.url, request))
  }

  if (decision.kind === 'rewrite') {
    const url = request.nextUrl.clone()
    url.pathname = decision.pathname
    return NextResponse.rewrite(url)
  }

  return null
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const hostResponse = handleHostRouting(request)
  if (hostResponse) return hostResponse

  const { pathname } = request.nextUrl
  const b2bToken = request.cookies.get(COOKIE_NAME)?.value
  const shopToken = request.cookies.get(SHOP_COOKIE_NAME)?.value
  const b2bPayload = b2bToken ? await verifyB2bToken(b2bToken) : null
  const shopPayload = shopToken ? await verifyShopToken(shopToken) : null

  if (pathname.startsWith('/api/shop-auth/')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/shop/')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/shop-admin/')) {
    if (resolveShopAdminApiRoute(!!shopPayload) === 'unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    if (!b2bPayload) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/shop-admin')) {
    const shopDecision = resolveShopAdminRoute(pathname, !!shopPayload)
    if (shopDecision === 'redirect-panel') {
      return NextResponse.redirect(buildRedirectUrl('/shop-admin', request))
    }
    if (shopDecision === 'redirect-login') {
      return NextResponse.redirect(buildRedirectUrl('/shop-admin/login', request))
    }
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin')) {
    const adminDecision = resolveB2bAdminRoute(pathname, b2bPayload)
    if (adminDecision === 'redirect-admin') {
      return NextResponse.redirect(buildRedirectUrl('/admin', request))
    }
    if (adminDecision === 'redirect-storefront') {
      return NextResponse.redirect(buildRedirectUrl(`/${defaultLocale}/storefront`, request))
    }
    if (adminDecision === 'redirect-login') {
      return NextResponse.redirect(buildRedirectUrl('/admin/login', request))
    }
    return NextResponse.next()
  }

  const storefrontMatch = pathname.match(/^\/[^/]+\/storefront/)
  if (storefrontMatch) {
    const intlResponse = intlMiddleware(request)
    if (intlResponse.status >= 300 && intlResponse.status < 400) {
      return intlResponse
    }

    const locale = pathname.split('/')[1]
    const isAuthPage = AUTH_PAGES.some((page) => pathname.includes(page))
    const isPendingPage = pathname.includes('/pending')

    if (isAuthPage) {
      if (b2bPayload) {
        if (b2bPayload.role === 'ADMIN') {
          return NextResponse.redirect(buildRedirectUrl('/admin', request))
        }
        if (b2bPayload.status === 'PENDING') {
          return NextResponse.redirect(buildRedirectUrl(`/${locale}/storefront/pending`, request))
        }
        return NextResponse.redirect(buildRedirectUrl(`/${locale}/storefront`, request))
      }
      return intlResponse
    }

    if (!b2bPayload) {
      return NextResponse.redirect(buildRedirectUrl(`/${locale}/storefront/login`, request))
    }

    if (b2bPayload.status === 'PENDING') {
      if (!isPendingPage) {
        return NextResponse.redirect(buildRedirectUrl(`/${locale}/storefront/pending`, request))
      }
      return intlResponse
    }

    if (b2bPayload.status === 'ACTIVE' && isPendingPage) {
      return NextResponse.redirect(buildRedirectUrl(`/${locale}/storefront`, request))
    }

    return intlResponse
  }

  const isLocaleRoot = pathname.match(/^\/[^/]+$/)
  const isMarketingPage = pathname.match(/^\/[^/]+\/(about|services|contact)/)
  const isShopRoute = pathname.match(/^\/[^/]+\/shop/)

  if (isLocaleRoot || isMarketingPage || isShopRoute) {
    const intlResponse = intlMiddleware(request)
    if (intlResponse.status >= 300 && intlResponse.status < 400) {
      return intlResponse
    }
    return intlResponse
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/admin/:path*',
    '/shop-admin/:path*',
    '/:locale',
    '/:locale/:path*',
  ],
}
