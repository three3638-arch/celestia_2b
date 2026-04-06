import { NextRequest, NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'
import { COOKIE_NAME } from '@/lib/jwt-config'
import type { ApiResponse } from '@/types'

/**
 * POST /api/auth/logout - JSON 响应（保留兼容）
 */
export async function POST(): Promise<NextResponse<ApiResponse<null>>> {
  try {
    await clearAuthCookie()
    
    return NextResponse.json(
      { success: true, message: 'Logout successful' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/logout?locale=en - 清除 cookie 并直接 302 重定向到登录页
 * 在同一个 HTTP 响应中完成 cookie 清除和重定向，最可靠
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const rawLocale = request.nextUrl.searchParams.get('locale') || 'en'
  const validLocales = ['en', 'ar', 'zh']
  const locale = validLocales.includes(rawLocale) ? rawLocale : 'en'

  // 使用 x-forwarded-host 获取真实域名（Nginx 反代后 request.url 是容器内网地址）
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host
  const protocol = request.headers.get('x-forwarded-proto') || 'https'
  const loginUrl = `${protocol}://${host}/${locale}/storefront/login`
  const response = NextResponse.redirect(loginUrl)

  const domain = process.env.NODE_ENV === 'production'
    ? process.env.COOKIE_DOMAIN || undefined
    : undefined

  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 0,
  })

  return response
}
