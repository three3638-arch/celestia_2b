import { getClientIp } from '@/lib/rate-limit'
import type { ApiResponse } from '@/types'

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
}

export async function verifyTurnstileToken(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}),
  })

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('Turnstile verify error:', err)
    return false
  }
}

/** 已配置 Turnstile 时校验 token；失败返回 ApiResponse 错误 */
export async function assertTurnstileValid(token: string | undefined): Promise<ApiResponse | null> {
  if (!isTurnstileConfigured()) return null
  const ip = await getClientIp()
  const ok = await verifyTurnstileToken(token, ip)
  if (!ok) {
    return { success: false, error: '人机验证失败，请刷新后重试' }
  }
  return null
}
