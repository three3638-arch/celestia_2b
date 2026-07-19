'use server'

import { prisma } from '@/lib/db'
import { requireShopUser, requireShopAdmin } from '@/lib/shop-auth'
import { shopCategorySchema } from '@/lib/validations/shop'
import type { ApiResponse } from '@/types'

export async function getShopCategories(publicOnly = false) {
  return prisma.shopCategory.findMany({
    where: publicOnly ? { status: 'ACTIVE' } : undefined,
    orderBy: { sortOrder: 'asc' },
  })
}

export async function createShopCategory(data: unknown): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const parsed = shopCategorySchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
    }
    await prisma.shopCategory.create({ data: parsed.data })
    return { success: true, message: '品类创建成功' }
  } catch {
    return { success: false, error: 'Unauthorized' }
  }
}

export async function updateShopCategory(id: string, data: unknown): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const parsed = shopCategorySchema.partial().safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
    }
    await prisma.shopCategory.update({ where: { id }, data: parsed.data })
    return { success: true, message: '品类更新成功' }
  } catch {
    return { success: false, error: '更新失败' }
  }
}

export async function deleteShopCategory(id: string): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const count = await prisma.shopProduct.count({ where: { categoryId: id } })
    if (count > 0) {
      return { success: false, error: '该品类下仍有商品，无法删除' }
    }
    await prisma.shopCategory.delete({ where: { id } })
    return { success: true, message: '品类已删除' }
  } catch {
    return { success: false, error: '删除失败' }
  }
}
