import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from './db'
import { SHOP_JWT_SECRET, SHOP_COOKIE_NAME, SHOP_COOKIE_MAX_AGE } from './shop-jwt-config'

export interface ShopJwtPayload {
  shopUserId: string
  role: 'SHOP_ADMIN' | 'SHOP_EDITOR'
  iat: number
  exp: number
}

export interface ShopSessionUser {
  id: string
  phone: string
  name: string
  role: 'SHOP_ADMIN' | 'SHOP_EDITOR'
}

export async function signShopToken(payload: {
  shopUserId: string
  role: string
}): Promise<string> {
  return new SignJWT({ shopUserId: payload.shopUserId, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SHOP_JWT_SECRET)
}

export async function verifyShopToken(token: string): Promise<ShopJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SHOP_JWT_SECRET)
    return payload as unknown as ShopJwtPayload
  } catch {
    return null
  }
}

export async function setShopAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const domain =
    process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN || undefined : undefined

  cookieStore.set(SHOP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: SHOP_COOKIE_MAX_AGE,
  })
}

export async function clearShopAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  const domain =
    process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN || undefined : undefined

  cookieStore.set(SHOP_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 0,
  })
}

export async function getCurrentShopUser(): Promise<ShopSessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SHOP_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyShopToken(token)
  if (!payload) return null

  const user = await prisma.shopUser.findUnique({
    where: { id: payload.shopUserId },
    select: { id: true, phone: true, name: true, role: true },
  })

  if (!user) return null

  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  }
}

export async function requireShopUser(): Promise<ShopSessionUser> {
  const user = await getCurrentShopUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireShopAdmin(): Promise<ShopSessionUser> {
  const user = await requireShopUser()
  if (user.role !== 'SHOP_ADMIN') {
    throw new Error('Forbidden')
  }
  return user
}
