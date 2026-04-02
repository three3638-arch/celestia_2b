import { z } from 'zod'

// 创建品类 Schema
export const createCategorySchema = z.object({
  nameZh: z.string().min(1, '中文名称不能为空'),
  nameEn: z.string().optional(),
  nameAr: z.string().optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
