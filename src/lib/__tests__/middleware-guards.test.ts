import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveShopAdminRoute,
  resolveB2bAdminRoute,
  resolveShopAdminApiRoute,
} from '../middleware-guards'

describe('resolveShopAdminRoute', () => {
  it('allows login page when unauthenticated', () => {
    assert.equal(resolveShopAdminRoute('/shop-admin/login', false), 'allow')
  })

  it('redirects authenticated users away from login', () => {
    assert.equal(resolveShopAdminRoute('/shop-admin/login', true), 'redirect-panel')
  })

  it('guards panel routes without cookie', () => {
    assert.equal(resolveShopAdminRoute('/shop-admin/products', false), 'redirect-login')
    assert.equal(resolveShopAdminRoute('/shop-admin/products', true), 'allow')
  })
})

describe('resolveB2bAdminRoute', () => {
  it('allows admin login when unauthenticated', () => {
    assert.equal(resolveB2bAdminRoute('/admin/login', null), 'allow')
  })

  it('redirects logged-in admin away from login', () => {
    assert.equal(resolveB2bAdminRoute('/admin/login', { role: 'ADMIN' }), 'redirect-admin')
  })

  it('blocks customer from admin panel', () => {
    assert.equal(resolveB2bAdminRoute('/admin/orders', { role: 'CUSTOMER' }), 'redirect-storefront')
    assert.equal(resolveB2bAdminRoute('/admin/orders', { role: 'ADMIN' }), 'allow')
  })
})

describe('resolveShopAdminApiRoute', () => {
  it('requires shop token for shop-admin API', () => {
    assert.equal(resolveShopAdminApiRoute(false), 'unauthorized')
    assert.equal(resolveShopAdminApiRoute(true), 'allow')
  })
})
