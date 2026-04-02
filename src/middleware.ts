import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { JWT_SECRET, COOKIE_NAME } from './lib/jwt-config'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './i18n/config'

// 公开路由（无需登录）
const PUBLIC_ROUTES = [
  '/api/auth/',
]

// 登录/注册页面路径
const AUTH_PAGES = [
  '/login',
  '/register',
]

// 检查路径是否匹配
function matchesPath(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => path.startsWith(pattern) || path.includes(pattern))
}

// 验证 JWT
async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; role: 'ADMIN' | 'CUSTOMER'; status: 'PENDING' | 'ACTIVE' }
  } catch {
    return null
  }
}

// 创建 next-intl 中间件（仅用于 storefront 路由）
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  
  // 获取 token
  const token = request.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token) : null
  
  // 1. API 认证路由（除 /api/auth/* 外）
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }
  
  // 2. 管理路由（仅 ADMIN 角色）- 不走国际化
  if (pathname.startsWith('/admin')) {
    // 排除 /admin/login 页面
    if (pathname === '/admin/login') {
      if (payload?.role === 'ADMIN') {
        // 已是管理员，重定向到 admin 首页
        const adminUrl = new URL('/admin', request.url)
        return NextResponse.redirect(adminUrl)
      }
      // 未登录或非管理员，允许访问登录页
      return NextResponse.next()
    }

    if (!payload) {
      // 未登录，重定向到 admin 登录页
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }

    if (payload.role !== 'ADMIN') {
      // CUSTOMER 访问 admin 路由，重定向到商品列表（使用默认 locale）
      const productsUrl = new URL(`/${defaultLocale}/storefront/products`, request.url)
      return NextResponse.redirect(productsUrl)
    }

    return NextResponse.next()
  }
  
  // 3. 客户路由（storefront）- 走国际化
  // 检查是否是 storefront 路由
  const storefrontMatch = pathname.match(/^\/[^/]+\/storefront/)
  if (storefrontMatch) {
    // 先执行 next-intl 中间件处理 locale
    const intlResponse = intlMiddleware(request)
    
    // 如果 next-intl 返回重定向（如 locale 不匹配），直接返回
    if (intlResponse.status !== 200) {
      return intlResponse
    }
    
    const locale = pathname.split('/')[1]
    
    // 检查是否是登录/注册页面
    const isAuthPage = AUTH_PAGES.some(page => pathname.includes(page))
    
    // 检查是否是 pending 页面
    const isPendingPage = pathname.includes('/pending')
    
    // 登录/注册页面：已登录用户重定向
    if (isAuthPage) {
      if (payload) {
        // 已登录，根据角色重定向
        if (payload.role === 'ADMIN') {
          const adminUrl = new URL('/admin', request.url)
          return NextResponse.redirect(adminUrl)
        } else {
          // CUSTOMER: 根据状态重定向
          if (payload.status === 'PENDING') {
            const pendingUrl = new URL(`/${locale}/storefront/pending`, request.url)
            return NextResponse.redirect(pendingUrl)
          } else {
            const productsUrl = new URL(`/${locale}/storefront/products`, request.url)
            return NextResponse.redirect(productsUrl)
          }
        }
      }
      return intlResponse
    }
    
    // 其他 storefront 页面需要登录
    if (!payload) {
      const loginUrl = new URL(`/${locale}/storefront/login`, request.url)
      return NextResponse.redirect(loginUrl)
    }
    
    // PENDING 用户限制：只能访问 /pending 页面
    if (payload.status === 'PENDING') {
      if (!isPendingPage) {
        // PENDING 用户访问非 pending 页面，重定向到 pending 页面
        const pendingUrl = new URL(`/${locale}/storefront/pending`, request.url)
        return NextResponse.redirect(pendingUrl)
      }
      // 允许访问 pending 页面
      return intlResponse
    }
    
    // ACTIVE 用户：访问 pending 页面时重定向到首页
    if (payload.status === 'ACTIVE' && isPendingPage) {
      const storefrontUrl = new URL(`/${locale}/storefront`, request.url)
      return NextResponse.redirect(storefrontUrl)
    }
    
    return intlResponse
  }
  
  // 其他路由放行
  return NextResponse.next()
}

// 配置匹配路径
export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/:locale/storefront/:path*',
  ],
}
