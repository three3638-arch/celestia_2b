'use server'

import { prisma } from '@/lib/db'
import { requireShopUser, requireShopAdmin } from '@/lib/shop-auth'
import { resolveShopPrice } from '@/lib/shop-price'
import { shopInquirySchema } from '@/lib/validations/shop'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isHoneypotTripped } from '@/lib/honeypot'
import { assertTurnstileValid } from '@/lib/turnstile'
import type { ApiResponse } from '@/types'
import type { ShopInquiryStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

export async function submitShopInquiry(data: unknown): Promise<ApiResponse> {
  const rate = await enforceRateLimit('shop-inquiry')
  if (!rate.ok) return { success: false, error: rate.error }

  const parsed = shopInquirySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
  }

  if (isHoneypotTripped(parsed.data as Record<string, unknown>)) {
    return { success: true, message: '提交成功' }
  }

  const captchaError = await assertTurnstileValid(parsed.data.turnstileToken)
  if (captchaError) return captchaError

  const { productId, variantId, name, phone, email, message } = parsed.data

  const product = await prisma.shopProduct.findFirst({
    where: { id: productId, status: 'ACTIVE' },
    include: { variants: true },
  })
  if (!product) {
    return { success: false, error: '商品不存在或已下架' }
  }

  let variant = product.variants[0]
  if (variantId) {
    variant = product.variants.find((v) => v.id === variantId) || variant
  }
  if (!variant) {
    return { success: false, error: '商品规格不可用' }
  }

  const price = resolveShopPrice(variant)

  await prisma.shopInquiry.create({
    data: {
      productId,
      variantId: variant.id,
      name,
      phone,
      email: email || null,
      message: message || null,
      listPriceSnapshot: new Prisma.Decimal(price.listPrice),
      currentPriceSnapshot: new Prisma.Decimal(price.currentPrice),
    },
  })

  return { success: true, message: '询价提交成功' }
}

export async function getShopInquiries() {
  await requireShopUser()
  return prisma.shopInquiry.findMany({
    include: {
      product: { select: { slug: true, titleZh: true, titleEn: true } },
      variant: { select: { variantCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateShopInquiryStatus(
  id: string,
  status: ShopInquiryStatus,
  adminNote?: string
): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    await prisma.shopInquiry.update({
      where: { id },
      data: { status, adminNote },
    })
    return { success: true, message: '状态已更新' }
  } catch {
    return { success: false, error: '更新失败' }
  }
}
