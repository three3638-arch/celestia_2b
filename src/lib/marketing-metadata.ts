import type { Metadata } from 'next'

export function buildMarketingPageMetadata(
  locale: string,
  path: string,
  title: string,
  description: string
): Metadata {
  const base = (process.env.NEXT_PUBLIC_MARKETING_URL || 'http://localhost:3000').replace(/\/$/, '')
  const url = `${base}/${locale}${path}`
  return {
    title: `${title} | Celestia`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Celestia`,
      description,
      url,
      siteName: 'Celestia Jewelry',
      type: 'website',
    },
  }
}
