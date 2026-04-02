'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { GemType, MetalColor } from '@prisma/client'

// ============================================================
// 类型定义
// ============================================================

/** 隐藏商品列表项 */
export interface HiddenProductItem {
  id: string
  productId: string
  spuCode: string
  nameZh: string | null
  nameEn: string | null
  nameAr: string | null
  minPriceSar: string | null
  maxPriceSar: string | null
  primaryImageUrl: string | null
  primaryImageThumbnailUrl: string | null
  gemTypes: GemType[]
  metalColors: MetalColor[]
  hiddenAt: Date
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 验证用户是否已登录且状态为 ACTIVE
 */
async function requireActiveUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  if (user.status !== 'ACTIVE') {
    throw new Error('Account not activated')
  }
  return user
}

// ============================================================
// 隐藏操作
// ============================================================

/**
 * 切换隐藏状态
 * - 已隐藏则取消，未隐藏则添加
 * - 返回当前隐藏状态
 */
export async function toggleHidden(
  productId: string
): Promise<ApiResponse<{ isHidden: boolean }>> {
  try {
    const user = await requireActiveUser()

    // 检查商品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })

    if (!product) {
      return { success: false, error: '商品不存在' }
    }

    // 检查是否已隐藏
    const existingHidden = await prisma.productHidden.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    })

    if (existingHidden) {
      // 已隐藏，取消隐藏
      await prisma.productHidden.delete({
        where: { id: existingHidden.id },
      })
      return { success: true, data: { isHidden: false } }
    } else {
      // 未隐藏，添加隐藏
      await prisma.productHidden.create({
        data: {
          userId: user.id,
          productId,
        },
      })
      return { success: true, data: { isHidden: true } }
    }
  } catch (error) {
    console.error('Failed to toggle hidden:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Account not activated')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '操作失败，请稍后重试' }
  }
}

/**
 * 获取当前用户的隐藏商品列表
 * - 游标分页
 * - 包含商品图片、名称、价格等信息
 */
export async function getHiddenProducts(params: {
  cursor?: string
  pageSize?: number
}): Promise<PaginatedResponse<HiddenProductItem>> {
  try {
    const user = await requireActiveUser()
    const { cursor, pageSize = 20 } = params

    // 构建查询条件
    const where: Record<string, unknown> = {
      userId: user.id,
    }

    // 游标条件
    if (cursor) {
      const cursorHidden = await prisma.productHidden.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })

      if (cursorHidden) {
        where.createdAt = { lt: cursorHidden.createdAt }
      }
    }

    // 查询隐藏记录（多取一条判断是否还有更多）
    const hiddenProducts = await prisma.productHidden.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: pageSize + 1,
      select: {
        id: true,
        productId: true,
        createdAt: true,
        product: {
          select: {
            spuCode: true,
            nameZh: true,
            nameEn: true,
            nameAr: true,
            minPriceSar: true,
            maxPriceSar: true,
            gemTypes: true,
            metalColors: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: {
                url: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    })

    const hasMore = hiddenProducts.length > pageSize
    const items = hasMore ? hiddenProducts.slice(0, pageSize) : hiddenProducts
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    // 格式化返回数据
    const formattedItems: HiddenProductItem[] = items.map(hidden => ({
      id: hidden.id,
      productId: hidden.productId,
      spuCode: hidden.product.spuCode,
      nameZh: hidden.product.nameZh,
      nameEn: hidden.product.nameEn,
      nameAr: hidden.product.nameAr,
      minPriceSar: hidden.product.minPriceSar?.toString() ?? null,
      maxPriceSar: hidden.product.maxPriceSar?.toString() ?? null,
      primaryImageUrl: hidden.product.images[0]?.url ?? null,
      primaryImageThumbnailUrl: hidden.product.images[0]?.thumbnailUrl ?? null,
      gemTypes: hidden.product.gemTypes,
      metalColors: hidden.product.metalColors,
      hiddenAt: hidden.createdAt,
    }))

    return {
      items: formattedItems,
      total: items.length,
      hasMore,
      nextCursor,
    }
  } catch (error) {
    console.error('Failed to get hidden products:', error)
    return { items: [], total: 0, hasMore: false }
  }
}

/**
 * 获取当前用户所有隐藏的 productId 数组
 * - 用于商品列表过滤
 */
export async function getUserHiddenIds(): Promise<ApiResponse<{ productIds: string[] }>> {
  try {
    const user = await requireActiveUser()

    const hiddenProducts = await prisma.productHidden.findMany({
      where: { userId: user.id },
      select: { productId: true },
    })

    const productIds = hiddenProducts.map(h => h.productId)

    return { success: true, data: { productIds } }
  } catch (error) {
    console.error('Failed to get hidden ids:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Account not activated')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '获取隐藏列表失败' }
  }
}
