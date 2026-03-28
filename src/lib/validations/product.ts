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
