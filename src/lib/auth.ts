import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { JWT_SECRET, COOKIE_NAME, COOKIE_MAX_AGE } from './jwt-config'
import type { JwtPayload, SessionUser } from '@/types'

/**
 * 签发 JWT
 */
export async function signToken(payload: { userId: string; role: string; status: string }): Promise<string> {
  const token = await new SignJWT({ userId: payload.userId, role: payload.role, status: payload.status })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
  
  return token
}

/**
 * 验证 JWT
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

/**
 * 设置认证 Cookie
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const domain = process.env.NODE_ENV === 'production'
    ? process.env.COOKIE_DOMAIN || undefined
    : undefined

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: COOKIE_MAX_AGE,
  })
}

/**
 * 清除认证 Cookie
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  const domain = process.env.NODE_ENV === 'production'
    ? process.env.COOKIE_DOMAIN || undefined
    : undefined

  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 0,
  })
}

/**
 * 获取当前用户（从 cookie 中读取并验证）
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  
  if (!token) {
    return null
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }
  
  // 查询数据库获取完整用户信息
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      phone: true,
      name: true,
      company: true,
      role: true,
      status: true,
      markupRatio: true,
      preferredLang: true,
    },
  })
  
  if (!user) {
    return null
  }
  
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    company: user.company,
    role: user.role,
    status: user.status,
    markupRatio: user.markupRatio.toString(),
    preferredLang: user.preferredLang,
  }
}
