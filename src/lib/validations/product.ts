import { z } from 'zod'

export const productFilterSchema = z.object({
  categoryId: z.string().optional(),
  gemType: z.enum(['MOISSANITE', 'ZIRCON']).optional(),
  metalColor: z.enum(['SILVER', 'GOLD', 'ROSE_GOLD', 'OTHER']).optional(),
  keyword: z.string().max(100).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'popular']).optional(),
  cursor: z.string().optional(),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export type ProductFilterInput = z.infer<typeof productFilterSchema>

// 创建 SKU schema
export const createSkuSchema = z.object({
  gemType: z.enum(['MOISSANITE', 'ZIRCON']),
  metalColor: z.enum(['SILVER', 'GOLD', 'ROSE_GOLD', 'OTHER']),
  mainStoneSize: z.string().max(20).optional(),
  size: z.string().max(20).optional(),
  chainLength: z.string().max(20).optional(),
  stockStatus: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']).default('IN_STOCK'),
  referencePriceSar: z.string().optional(), // Decimal as string
})

// 创建商品 schema
export const createProductSchema = z.object({
  spuCode: z.string().min(1).max(50),
  nameZh: z.string().max(200).optional(),
  nameEn: z.string().max(200).optional(),
  nameAr: z.string().max(200).optional(),
  descriptionZh: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  descriptionAr: z.string().max(2000).optional(),
  supplier: z.string().max(100).optional(),
  supplierLink: z.string().max(500).optional(),
  categoryId: z.string(),
  gemTypes: z.array(z.enum(['MOISSANITE', 'ZIRCON'])),
  metalColors: z.array(z.enum(['SILVER', 'GOLD', 'ROSE_GOLD', 'OTHER'])),
  skus: z.array(createSkuSchema).min(1),
  images: z.array(z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url(),
    isPrimary: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
  })).optional(),
})

// 更新商品 schema（大部分字段可选）
export const updateProductSchema = createProductSchema.partial().omit({ spuCode: true })

// 更新 SKU 库存状态
export const updateSkuStockSchema = z.object({
  skuId: z.string(),
  stockStatus: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']),
})
