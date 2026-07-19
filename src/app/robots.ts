import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getMarketingSitemapBase, getShopSitemapBase, getB2bSitemapBase } from '@/lib/sitemap-builders'
import { getSiteKind } from '@/lib/host-routing'

export const dynamic = 'force-dynamic'

async function getHostFromHeaders(): Promise<string> {
  const h = await headers()
  const raw = h.get('x-forwarded-host') || h.get('host') || 'localhost'
  return raw.split(':')[0].toLowerCase()
}

/** 按请求 Host 返回对应子域的 robots / sitemap */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await getHostFromHeaders()
  const kind = getSiteKind(host)
  const marketing = getMarketingSitemapBase()
  const shop = getShopSitemapBase()
  const b2b = getB2bSitemapBase()

  if (kind === 'shop') {
    return {
      rules: { userAgent: '*', allow: '/' },
      sitemap: [`${shop}/sitemap/shop.xml`],
    }
  }

  if (kind === 'b2b') {
    return {
      rules: {
        userAgent: '*',
        allow: ['/*/storefront', '/en/storefront', '/ar/storefront', '/zh/storefront'],
        disallow: ['/admin', '/shop-admin', '/api/'],
      },
      sitemap: [`${b2b}/sitemap/b2b.xml`],
    }
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [`${marketing}/sitemap/marketing.xml`],
  }
}
