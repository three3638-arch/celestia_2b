import { test, expect } from '@playwright/test'

test.describe('本地冒烟', () => {
  test('官网首页可访问', async ({ page }) => {
    const res = await page.goto('/en')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('2C 商品目录可访问', async ({ page }) => {
    const res = await page.goto('/en/shop')
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('2B 管理登录页可访问', async ({ page }) => {
    const res = await page.goto('/admin/login')
    expect(res?.status()).toBeLessThan(400)
  })

  test('2B 客户端登录页可访问', async ({ page }) => {
    const res = await page.goto('/en/storefront/login')
    expect(res?.status()).toBeLessThan(400)
  })

  test('2C 后台登录页可访问', async ({ page }) => {
    const res = await page.goto('/shop-admin/login')
    expect(res?.status()).toBeLessThan(400)
  })

  test('公开商品 API 返回 JSON', async ({ request }) => {
    const res = await request.get('/api/shop/products?locale=en')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data?.items)).toBeTruthy()
  })

  test('联系页可访问', async ({ page }) => {
    const res = await page.goto('/en/contact')
    expect(res?.status()).toBeLessThan(400)
  })

  test('目录→详情→询价', async ({ page }) => {
    const slug = 'e2e-test-ring'

    await page.goto('/en/shop')
    await page.getByRole('link', { name: 'E2E Test Ring' }).click()
    await expect(page).toHaveURL(new RegExp(`/en/shop/products/${slug}`))
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Test Ring' })).toBeVisible()

    await page.getByRole('link', { name: /Request Quote|立即询价/i }).click()
    await expect(page).toHaveURL(/productId=/)

    await page.getByLabel(/Your Name|姓名/i).fill('E2E Tester')
    await page.getByLabel(/Phone|手机/i).fill('13900009999')
    await page.getByRole('button', { name: /Submit Inquiry|提交询价/i }).click()

    await expect(page.getByText(/Thank you|提交成功/i)).toBeVisible({ timeout: 15_000 })
  })

  test('公开商品详情 API', async ({ request }) => {
    const res = await request.get('/api/shop/products/e2e-test-ring?locale=en')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data?.slug).toBe('e2e-test-ring')
  })

  test('shop 子域短路径 rewrite', async ({ request }) => {
    const res = await request.get('/en/products/e2e-test-ring', {
      headers: { Host: 'shop.celestia.com' },
    })
    expect(res.status()).toBeLessThan(400)
  })

  test('官网 admin 路径重定向到 B2B 子域', async ({ request }) => {
    const res = await request.get('/admin/login', {
      headers: { Host: 'celestia.com' },
      maxRedirects: 0,
    })
    expect([301, 302, 307, 308]).toContain(res.status())
    expect(res.headers()['location']).toMatch(/products\.celestia\.com\/admin\/login/)
  })
})
