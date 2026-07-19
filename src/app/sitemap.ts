import type { MetadataRoute } from 'next'
import { buildMarketingSitemap, buildShopSitemap, buildB2bSitemap } from '@/lib/sitemap-builders'

export async function generateSitemaps() {
  return [{ id: 'marketing' }, { id: 'shop' }, { id: 'b2b' }]
}

export default async function sitemap(props: {
  id: Promise<string>
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id
  if (id === 'shop') return buildShopSitemap()
  if (id === 'b2b') return buildB2bSitemap()
  return buildMarketingSitemap()
}
