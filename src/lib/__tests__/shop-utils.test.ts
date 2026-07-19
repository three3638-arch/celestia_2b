import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { aggregateProductPriceRange } from '../shop-price'
import { checkRateLimit } from '../rate-limit-store'

describe('aggregateProductPriceRange', () => {
  it('excludes out-of-stock variants from price range', () => {
    const range = aggregateProductPriceRange([
      { listPrice: '100', stockStatus: 'IN_STOCK' },
      { listPrice: '50', stockStatus: 'OUT_OF_STOCK' },
    ])
    assert.equal(range.minPrice, '100.00')
    assert.equal(range.maxPrice, '100.00')
  })
})

describe('checkRateLimit', () => {
  it('blocks after limit exceeded', async () => {
    const key = `test-${Date.now()}`
    assert.equal((await checkRateLimit(key, 2, 60_000)).ok, true)
    assert.equal((await checkRateLimit(key, 2, 60_000)).ok, true)
    const blocked = await checkRateLimit(key, 2, 60_000)
    assert.equal(blocked.ok, false)
    if (!blocked.ok) assert.ok(blocked.retryAfterSec > 0)
  })
})
