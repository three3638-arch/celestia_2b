import { createClient, type RedisClientType } from 'redis'
import type { RateLimitCheckResult, RateLimitStore } from '@/lib/rate-limit-store'
import { MemoryRateLimitStore } from '@/lib/rate-limit-memory'

const KEY_PREFIX = 'celestia:ratelimit:'

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null

export async function getRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL
  if (!url) return null

  if (client?.isOpen) return client

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const c = createClient({ url })
        c.on('error', (err) => console.error('[Redis]', err))
        await c.connect()
        client = c
        return c
      } catch (err) {
        console.error('[Redis] connect failed, falling back to memory:', err)
        connectPromise = null
        return null
      }
    })()
  }

  return connectPromise
}

export class RedisRateLimitStore implements RateLimitStore {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitCheckResult> {
    const redis = await getRedisClient()
    if (!redis) {
      return new MemoryRateLimitStore().check(key, limit, windowMs)
    }

    const redisKey = `${KEY_PREFIX}${key}`
    const count = await redis.incr(redisKey)
    if (count === 1) {
      await redis.pExpire(redisKey, windowMs)
    }

    if (count > limit) {
      const ttlMs = await redis.pTTL(redisKey)
      const retryAfterSec = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000))
      return { ok: false, retryAfterSec }
    }

    return { ok: true }
  }
}
