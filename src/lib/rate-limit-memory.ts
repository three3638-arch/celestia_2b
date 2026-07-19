import type { RateLimitCheckResult, RateLimitStore } from '@/lib/rate-limit-store'

interface Bucket {
  count: number
  resetAt: number
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>()

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitCheckResult> {
    const now = Date.now()
    const entry = this.buckets.get(key)

    if (!entry || now >= entry.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return { ok: true }
    }

    if (entry.count >= limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
    }

    entry.count += 1
    return { ok: true }
  }
}
