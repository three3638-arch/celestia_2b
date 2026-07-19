import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getSiteKind,
  rewriteShopHostPath,
  resolveUnknownHostRedirect,
  isShopPath,
} from '../host-routing'

describe('getSiteKind', () => {
  it('recognizes known hosts', () => {
    assert.equal(getSiteKind('localhost'), 'local')
    assert.equal(getSiteKind('celestia.com'), 'marketing')
    assert.equal(getSiteKind('shop.celestia.com'), 'shop')
    assert.equal(getSiteKind('products.celestia.com'), 'b2b')
  })

  it('returns unknown for unrecognized hosts', () => {
    assert.equal(getSiteKind('47.114.83.193'), 'unknown')
    assert.equal(getSiteKind('evil.example.com'), 'unknown')
  })
})

describe('rewriteShopHostPath', () => {
  it('rewrites product short paths to internal shop paths', () => {
    assert.equal(rewriteShopHostPath('/en/products/ring-a'), '/en/shop/products/ring-a')
    assert.equal(rewriteShopHostPath('/en/inquiry'), '/en/shop/inquiry')
    assert.equal(rewriteShopHostPath('/en'), '/en/shop')
  })

  it('rewrites inquiry short path', () => {
    assert.equal(rewriteShopHostPath('/zh/inquiry'), '/zh/shop/inquiry')
  })

  it('returns null for unrelated paths', () => {
    assert.equal(rewriteShopHostPath('/en/about'), null)
  })
})

describe('resolveUnknownHostRedirect', () => {
  const prev = process.env.NEXT_PUBLIC_MARKETING_URL
  const prevShop = process.env.NEXT_PUBLIC_SHOP_URL
  const prevB2b = process.env.NEXT_PUBLIC_B2B_URL

  before(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = 'https://celestia.com'
    process.env.NEXT_PUBLIC_SHOP_URL = 'https://shop.celestia.com'
    process.env.NEXT_PUBLIC_B2B_URL = 'https://products.celestia.com'
  })

  after(() => {
    process.env.NEXT_PUBLIC_MARKETING_URL = prev
    process.env.NEXT_PUBLIC_SHOP_URL = prevShop
    process.env.NEXT_PUBLIC_B2B_URL = prevB2b
  })

  it('redirects admin and shop paths to canonical subdomains', () => {
    assert.equal(
      resolveUnknownHostRedirect('/admin/login'),
      'https://products.celestia.com/admin/login'
    )
    assert.equal(
      resolveUnknownHostRedirect('/en/shop/products/foo'),
      'https://shop.celestia.com/en/products/foo'
    )
    assert.equal(resolveUnknownHostRedirect('/en/about'), 'https://celestia.com/en/about')
  })

  it('uses isShopPath consistently', () => {
    assert.equal(isShopPath('/en/shop'), true)
    assert.equal(isShopPath('/en/storefront'), false)
  })
})
