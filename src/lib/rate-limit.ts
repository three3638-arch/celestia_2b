import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit-store'

/**
 * 统一限流入口（表单 Server Action + 公开 API 共用 store）。
 * 设置 REDIS_URL 后跨副本共享计数；未配置时使用内存 Map。
 */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export async function enforceRateLimitByKey(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const result = await checkRateLimit(key, limit, windowMs)
  if (!result.ok) {
    return { ok: false, retryAfterSec: result.retryAfterSec }
  }
  return { ok: true }
}

export async function enforceRateLimit(
  scope: string,
  limit = 5,
  windowMs = 15 * 60 * 1000
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await getClientIp()
  const result = await enforceRateLimitByKey(`${scope}:${ip}`, limit, windowMs)
  if (!result.ok) {
    return { ok: false, error: `提交过于频繁，请 ${result.retryAfterSec} 秒后再试` }
  }
  return { ok: true }
}

/** 公开 API 轻量限流：每 IP 每分钟 60 次 */
export async function enforceApiRateLimit(
  request: NextRequest,
  scope: string,
  limit = 60,
  windowMs = 60_000
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const ip = getRequestIp(request)
  const result = await enforceRateLimitByKey(`api:${scope}:${ip}`, limit, windowMs)
  if (!result.ok) {
    return { ok: false, status: 429, error: 'Too many requests' }
  }
  return { ok: true }
}
