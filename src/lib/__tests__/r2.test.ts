import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractR2KeyFromUrl } from '../r2'

describe('extractR2KeyFromUrl', () => {
  const prev = process.env.R2_PUBLIC_URL
  process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

  it('parses local uploads path', () => {
    assert.equal(
      extractR2KeyFromUrl('/uploads/shop/products/123-a1b2.webp'),
      'shop/products/123-a1b2.webp'
    )
  })

  it('parses public CDN URL', () => {
    assert.equal(
      extractR2KeyFromUrl('https://cdn.example.com/shop/products/123-a1b2.webp'),
      'shop/products/123-a1b2.webp'
    )
  })

  it('parses legacy b2b path', () => {
    assert.equal(
      extractR2KeyFromUrl('https://cdn.example.com/b2b/products/old.webp'),
      'b2b/products/old.webp'
    )
  })

  it('returns null for unrelated URLs', () => {
    assert.equal(extractR2KeyFromUrl('https://example.com/logo.png'), null)
  })

  process.env.R2_PUBLIC_URL = prev
})
