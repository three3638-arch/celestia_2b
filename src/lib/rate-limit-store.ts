import { MemoryRateLimitStore } from '@/lib/rate-limit-memory'

/**
 * 限流计数存储抽象层。
 * - 默认：进程内 Map（单 ECS 单实例）
 * - 生产：设置 REDIS_URL（Upstash / 自建 Redis 均可）后自动切换
 */

export interface RateLimitResult {
  ok: true
}

export interface RateLimitExceeded {
  ok: false
  retryAfterSec: number
}

export type RateLimitCheckResult = RateLimitResult | RateLimitExceeded

export interface RateLimitStore {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitCheckResult>
}

const memoryStore = new MemoryRateLimitStore()
let customStore: RateLimitStore | null = null
let redisStorePromise: Promise<RateLimitStore> | null = null

function shouldUseRedis(): boolean {
  if (process.env.RATE_LIMIT_STORE === 'memory') return false
  return Boolean(process.env.REDIS_URL) || process.env.RATE_LIMIT_STORE === 'redis'
}

async function resolveStore(): Promise<RateLimitStore> {
  if (customStore) return customStore
  if (!shouldUseRedis()) return memoryStore

  if (!redisStorePromise) {
    redisStorePromise = import('@/lib/rate-limit-redis').then(({ RedisRateLimitStore }) => new RedisRateLimitStore())
  }
  return redisStorePromise
}

/** 测试时注入 mock store */
export function setRateLimitStore(next: RateLimitStore): void {
  customStore = next
  redisStorePromise = null
}

export function getRateLimitStore(): RateLimitStore {
  return customStore ?? memoryStore
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitCheckResult> {
  const store = await resolveStore()
  return store.check(key, limit, windowMs)
}

export { MemoryRateLimitStore }
