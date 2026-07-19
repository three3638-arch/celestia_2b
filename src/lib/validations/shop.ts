import { z } from 'zod'
import { HONEYPOT_FIELD } from '@/lib/honeypot'

export const shopLoginSchema = z.object({
  phone: z.string().min(5).max(20),
  password: z.string().min(6),
})

export const shopCategorySchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  nameZh: z.string().min(1),
  nameEn: z.string().min(1),
  nameAr: z.string().min(1),
  sortOrder: z.number().int().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

export const shopVariantPricingSchema = z
  .object({
    id: z.string().optional(),
    variantCode: z.string().min(1),
    nameZh: z.string().optional(),
    nameEn: z.string().optional(),
    nameAr: z.string().optional(),
    stockStatus: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']).optional(),
    listPrice: z.coerce.number().positive(),
    salePrice: z.coerce.number().positive().optional().nullable(),
    saleStartAt: z.string().datetime().optional().nullable(),
    saleEndAt: z.string().datetime().optional().nullable(),
    currency: z.string().optional(),
    sortOrder: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.salePrice != null) {
      if (data.salePrice >= data.listPrice) {
        ctx.addIssue({ code: 'custom', message: '折扣价必须低于原价', path: ['salePrice'] })
      }
      if (!data.saleStartAt || !data.saleEndAt) {
        ctx.addIssue({ code: 'custom', message: '设置折扣价时必须填写开始和结束时间', path: ['saleStartAt'] })
      }
      if (data.saleStartAt && data.saleEndAt && data.saleEndAt <= data.saleStartAt) {
        ctx.addIssue({ code: 'custom', message: '折扣结束时间必须晚于开始时间', path: ['saleEndAt'] })
      }
    }
  })

export const shopProductSchema = z.object({
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  titleAr: z.string().min(1),
  descriptionZh: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  sortOrder: z.number().int().optional(),
})

export const shopInquirySchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(),
  [HONEYPOT_FIELD]: z.string().optional(),
  turnstileToken: z.string().optional(),
})
