'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createCategorySchema } from '@/lib/validations/category'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import { batchTranslate } from '@/lib/excel/translator'
import { getCanonicalCategoryI18n } from '@/lib/constants/category-i18n'
import type { ApiResponse } from '@/types'
import type { Category } from '@prisma/client'
import type { z } from 'zod'

// 字段名映射
const categoryFieldNameMap: Record<string, string> = {
  nameZh: '中文名称',
  nameEn: '英文名称',
  nameAr: '阿拉伯文名称',
}

/**
 * 获取所有品类（简单列表，不分页）
 * 返回 id, nameZh, nameEn, nameAr, sortOrder
 * 按 sortOrder 排序
 */
export async function getCategories(): Promise<Pick<Category, 'id' | 'nameZh' | 'nameEn' | 'nameAr' | 'sortOrder'>[]> {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      nameZh: true,
      nameEn: true,
      nameAr: true,
      sortOrder: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  })

  return categories
}

/**
 * 创建品类（管理端）
 */
export async function createCategory(data: {
  nameZh: string
  nameEn?: string
  nameAr?: string
}): Promise<ApiResponse> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    // 使用 Zod 验证输入数据，返回字段级错误
    const validation = createCategorySchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, categoryFieldNameMap) }
    }

    const validatedData = validation.data

    // 自动翻译：如果用户未填写英文或阿拉伯文名称，自动翻译
    let finalNameEn = validatedData.nameEn ?? ''
    let finalNameAr = validatedData.nameAr ?? ''

    if (!finalNameEn || !finalNameAr) {
      const canonical = getCanonicalCategoryI18n(validatedData.nameZh)
      try {
        const translations = await batchTranslate([validatedData.nameZh])
        finalNameEn =
          finalNameEn ||
          translations[0]?.en ||
          canonical?.nameEn ||
          `[EN] ${validatedData.nameZh}`
        finalNameAr =
          finalNameAr ||
          translations[0]?.ar ||
          canonical?.nameAr ||
          `[AR] ${validatedData.nameZh}`
      } catch (error) {
        console.error('[createCategory] Translation failed:', error)
        finalNameEn = finalNameEn || canonical?.nameEn || `[EN] ${validatedData.nameZh}`
        finalNameAr = finalNameAr || canonical?.nameAr || `[AR] ${validatedData.nameZh}`
      }
    }

    // 获取当前最大 sortOrder
    const lastCategory = await prisma.category.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    const nextSortOrder = (lastCategory?.sortOrder ?? 0) + 1

    await prisma.category.create({
      data: {
        nameZh: validatedData.nameZh,
        nameEn: finalNameEn,
        nameAr: finalNameAr,
        sortOrder: nextSortOrder,
      },
    })

    return { success: true, message: 'Category created successfully' }
  } catch (error) {
    console.error('Failed to create category:', error)
    return { success: false, error: 'Failed to create category' }
  }
}
