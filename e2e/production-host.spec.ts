import { test, expect } from '@playwright/test'

const MARKETING_URL = process.env.E2E_MARKETING_URL || 'https://celestia.com'
const SHOP_URL = process.env.E2E_SHOP_URL || 'https://shop.celestia.com'
const B2B_URL = process.env.E2E_B2B_URL || 'https://products.celestia.com'

test.describe('生产 HTTPS + Nginx 子域冒烟', () => {
  test.skip(!process.env.E2E_PRODUCTION, '设置 E2E_PRODUCTION=1 启用生产探测')

  test('官网 HTTPS 可访问', async ({ request }) => {
    const res = await request.get(`${MARKETING_URL}/en`)
    expect(res.status()).toBeLessThan(400)
  })

  test('商城 HTTPS 可访问', async ({ request }) => {
    const res = await request.get(`${SHOP_URL}/en`)
    expect(res.status()).toBeLessThan(400)
  })

  test('B2B 客户端 HTTPS 可访问', async ({ request }) => {
    const res = await request.get(`${B2B_URL}/en/storefront`)
    expect(res.status()).toBeLessThan(400)
  })

  test('官网 /admin 重定向到 B2B 子域', async ({ request }) => {
    const res = await request.get(`${MARKETING_URL}/admin/login`, { maxRedirects: 0 })
    expect([301, 302, 307, 308]).toContain(res.status())
    const location = res.headers()['location'] || ''
    expect(location).toMatch(/products\./)
    expect(location).toContain('/admin/login')
  })

  test('官网 /shop-admin 重定向到商城子域', async ({ request }) => {
    const res = await request.get(`${MARKETING_URL}/shop-admin/login`, { maxRedirects: 0 })
    expect([301, 302, 307, 308]).toContain(res.status())
    const location = res.headers()['location'] || ''
    expect(location).toMatch(/shop\./)
    expect(location).toContain('/shop-admin/login')
  })

  test('商城公开商品 API 经 HTTPS 可访问', async ({ request }) => {
    const res = await request.get(`${SHOP_URL}/api/shop/products?locale=en`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
