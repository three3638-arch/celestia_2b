import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'
import { locales } from '@/i18n/config'

function baseUrl(envVar: string | undefined, fallback: string): string {
  return (envVar || fallback).replace(/\/$/, '')
}

export function getMarketingSitemapBase(): string {
  return baseUrl(process.env.NEXT_PUBLIC_MARKETING_URL, 'http://localhost:3000')
}

export function getShopSitemapBase(): string {
  return baseUrl(process.env.NEXT_PUBLIC_SHOP_URL, 'http://localhost:3000')
}

export async function buildMarketingSitemap(): Promise<MetadataRoute.Sitemap> {
  const marketingBase = getMarketingSitemapBase()
  const now = new Date()
  const pages = ['', '/about', '/services', '/contact'] as const

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${marketingBase}/${locale}${page}`,
      lastModified: now,
      changeFrequency: page === '' ? ('weekly' as const) : ('monthly' as const),
      priority: page === '' ? 1 : 0.7,
    }))
  )
}

export function getB2bSitemapBase(): string {
  return baseUrl(process.env.NEXT_PUBLIC_B2B_URL, 'http://localhost:3000')
}

export async function buildB2bSitemap(): Promise<MetadataRoute.Sitemap> {
  const b2bBase = getB2bSitemapBase()
  const now = new Date()
  const pages = ['/storefront', '/storefront/login'] as const

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${b2bBase}/${locale}${page}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: page === '/storefront' ? 0.8 : 0.4,
    }))
  )
}

export async function buildShopSitemap(): Promise<MetadataRoute.Sitemap> {
  const shopBase = getShopSitemapBase()
  const now = new Date()
  const staticPages = ['', '/inquiry'] as const

  const staticEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    staticPages.map((page) => {
      const path = page === '' ? `/${locale}` : `/${locale}${page}`
      return {
        url: `${shopBase}${path}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: page === '' ? 0.9 : 0.5,
      }
    })
  )

  let productEntries: MetadataRoute.Sitemap = []
  try {
    const products = await prisma.shopProduct.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, updatedAt: true },
    })
    productEntries = locales.flatMap((locale) =>
      products.map((p) => ({
        url: `${shopBase}/${locale}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    )
  } catch {
    // 构建时数据库可能不可用
  }

  return [...staticEntries, ...productEntries]
}
