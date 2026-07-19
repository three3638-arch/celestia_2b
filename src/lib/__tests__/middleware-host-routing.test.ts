import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resolveHostRoutingDecision } from '../middleware-host-routing'

describe('resolveHostRoutingDecision', () => {
  const prevMarketing = process.env.NEXT_PUBLIC_MARKETING_URL
  const prevShop = process.env.NEXT_PUBLIC_SHOP_URL
  const prevB2b = process.env.NEXT_PUBLIC_B2B_URL

  before(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = 'https://celestia.com'
    process.env.NEXT_PUBLIC_SHOP_URL = 'https://shop.celestia.com'
    process.env.NEXT_PUBLIC_B2B_URL = 'https://products.celestia.com'
  })

  after(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = prevMarketing
    process.env.NEXT_PUBLIC_SHOP_URL = prevShop
    process.env.NEXT_PUBLIC_B2B_URL = prevB2b
  })

  it('passes through API routes', () => {
    assert.deepEqual(resolveHostRoutingDecision('celestia.com', '/api/shop/products'), { kind: 'pass' })
  })

  it('redirects marketing /admin to b2b subdomain', () => {
    const d = resolveHostRoutingDecision('celestia.com', '/admin/login')
    assert.equal(d.kind, 'redirect')
    if (d.kind === 'redirect') {
      assert.equal(d.url, 'https://products.celestia.com/admin/login')
    }
  })

  it('redirects marketing /shop-admin to shop subdomain', () => {
    const d = resolveHostRoutingDecision('celestia.com', '/shop-admin/login')
    assert.equal(d.kind, 'redirect')
    if (d.kind === 'redirect') {
      assert.equal(d.url, 'https://shop.celestia.com/shop-admin/login')
    }
  })

  it('rewrites shop short product path', () => {
    const d = resolveHostRoutingDecision('shop.celestia.com', '/en/products/foo')
    assert.deepEqual(d, { kind: 'rewrite', pathname: '/en/shop/products/foo' })
  })

  it('redirects unknown host in production', () => {
    const d = resolveHostRoutingDecision('47.114.83.193', '/admin', { isProduction: true })
    assert.equal(d.kind, 'redirect')
    if (d.kind === 'redirect') {
      assert.equal(d.url, 'https://products.celestia.com/admin')
    }
  })

  it('passes localhost without redirect', () => {
    assert.deepEqual(resolveHostRoutingDecision('localhost', '/admin/login'), { kind: 'pass' })
  })
})
