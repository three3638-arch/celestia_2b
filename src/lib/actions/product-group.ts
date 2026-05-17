'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export interface ProductGroupItem {
  id: string
  name: string
  productCount: number
  createdAt: Date
}

export async function getProductGroups(): Promise<ProductGroupItem[]> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return []
    }

    const groups = await prisma.productGroup.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
    })

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      productCount: g._count.products,
      createdAt: g.createdAt,
    }))
  } catch (error) {
    console.error('获取分组列表失败:', error)
    return []
  }
}

/**
 * 创建分组
 */
export async function createProductGroup(
  name: string
): Promise<{ success: boolean; data?: ProductGroupItem; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, error: '分组名称不能为空' }
    }

    const created = await prisma.productGroup.create({
      data: { name: trimmed },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: { products: true },
        },
      },
    })

    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        productCount: created._count.products,
        createdAt: created.createdAt,
      },
    }
  } catch (error) {
    console.error('创建分组失败:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { success: false, error: '分组名称已存在' }
    }
    return { success: false, error: '创建分组失败' }
  }
}

/**
 * 更新分组名称
 */
export async function updateProductGroup(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, error: '分组名称不能为空' }
    }

    await prisma.productGroup.update({
      where: { id },
      data: { name: trimmed },
    })

    return { success: true }
  } catch (error) {
    console.error('更新分组失败:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return { success: false, error: '分组名称已存在' }
    }
    return { success: false, error: '更新分组失败' }
  }
}

/**
 * 删除分组
 */
export async function deleteProductGroup(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.productGroup.delete({
      where: { id },
    })

    return { success: true }
  } catch (error) {
    console.error('删除分组失败:', error)
    return { success: false, error: '删除分组失败' }
  }
}

/**
 * 获取无分组商品数量
 */
export async function getUngroupedProductCount(): Promise<number> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return 0
    }

    const count = await prisma.product.count({
      where: { groupId: null },
    })

    return count
  } catch (error) {
    console.error('获取无分组商品数量失败:', error)
    return 0
  }
}

/**
 * 一键分配无分组商品到指定分组
 */
export async function assignUngroupedProducts(
  groupId: string | null,
  newGroupName?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    let targetGroupId = groupId

    // 如果提供了新分组名称，先创建分组
    if (newGroupName) {
      const trimmed = newGroupName.trim()
      if (!trimmed) {
        return { success: false, error: '分组名称不能为空' }
      }

      const existing = await prisma.productGroup.findUnique({
        where: { name: trimmed },
      })

      if (existing) {
        return { success: false, error: '分组名称已存在' }
      }

      const created = await prisma.productGroup.create({
        data: { name: trimmed },
      })
      targetGroupId = created.id
    }

    if (!targetGroupId) {
      return { success: false, error: '请选择或输入分组' }
    }

    const result = await prisma.product.updateMany({
      where: { groupId: null },
      data: { groupId: targetGroupId },
    })

    return {
      success: true,
      message: `已成功分配 ${result.count} 个商品`,
    }
  } catch (error) {
    console.error('分配无分组商品失败:', error)
    return { success: false, error: '分配无分组商品失败' }
  }
}

/**
 * 批量设置商品分组
 */
export async function batchSetProductGroup(
  productIds: string[],
  groupId: string | null
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { groupId },
    })

    return { success: true, message: '分组设置成功' }
  } catch (error) {
    console.error('批量设置分组失败:', error)
    return { success: false, error: '批量设置分组失败' }
  }
}

/**
 * 根据名称获取或创建分组
 */
export async function getOrCreateProductGroup(
  name: string
): Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, error: '分组名称不能为空' }
    }

    // 尝试查找已有分组
    const existing = await prisma.productGroup.findUnique({
      where: { name: trimmed },
      select: { id: true, name: true },
    })

    if (existing) {
      return { success: true, data: existing }
    }

    // 创建新分组
    const created = await prisma.productGroup.create({
      data: { name: trimmed },
      select: { id: true, name: true },
    })

    return { success: true, data: created }
  } catch (error) {
    console.error('获取或创建分组失败:', error)
    return { success: false, error: '获取或创建分组失败' }
  }
}
