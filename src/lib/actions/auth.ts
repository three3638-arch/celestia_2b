'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser, clearAuthCookie } from '@/lib/auth'
import type { SessionUser } from '@/types'

/**
 * 获取当前会话用户
 */
export async function getSession(): Promise<SessionUser | null> {
  return getCurrentUser()
}

/**
 * 登出（Server Action 版本，供客户端组件调用）
 * @param locale - 语言区域，默认为 'en'
 */
export async function logout(locale: string = 'en'): Promise<void> {
  await clearAuthCookie()
  redirect(`/${locale}/storefront/login`)
}
