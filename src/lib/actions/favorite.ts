'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { GemType, MetalColor } from '@prisma/client'

// ============================================================
// 类型定义
// ============================================================

/** 收藏商品列表项 */
export interface FavoriteProductItem {
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
  favoritedAt: Date
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
// 收藏操作
// ============================================================

/**
 * 切换收藏状态
 * - 已收藏则取消，未收藏则添加
 * - 返回当前收藏状态
 */
export async function toggleFavorite(
  productId: string
): Promise<ApiResponse<{ isFavorited: boolean }>> {
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

    // 检查是否已收藏
    const existingFavorite = await prisma.productFavorite.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    })

    if (existingFavorite) {
      // 已收藏，取消收藏
      await prisma.productFavorite.delete({
        where: { id: existingFavorite.id },
      })
      return { success: true, data: { isFavorited: false } }
    } else {
      // 未收藏，添加收藏
      await prisma.productFavorite.create({
        data: {
          userId: user.id,
          productId,
        },
      })
      return { success: true, data: { isFavorited: true } }
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Account not activated')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '操作失败，请稍后重试' }
  }
}

/**
 * 获取当前用户的收藏商品列表
 * - 游标分页
 * - 包含商品图片、名称、价格等信息
 */
export async function getFavoriteProducts(params: {
  cursor?: string
  pageSize?: number
}): Promise<PaginatedResponse<FavoriteProductItem>> {
  try {
    const user = await requireActiveUser()
    const { cursor, pageSize = 20 } = params

    // 构建查询条件
    const where: Record<string, unknown> = {
      userId: user.id,
    }

    // 游标条件
    if (cursor) {
      const cursorFavorite = await prisma.productFavorite.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })

      if (cursorFavorite) {
        where.createdAt = { lt: cursorFavorite.createdAt }
      }
    }

    // 查询收藏记录（多取一条判断是否还有更多）
    const favorites = await prisma.productFavorite.findMany({
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

    const hasMore = favorites.length > pageSize
    const items = hasMore ? favorites.slice(0, pageSize) : favorites
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    // 格式化返回数据
    const formattedItems: FavoriteProductItem[] = items.map(fav => ({
      id: fav.id,
      productId: fav.productId,
      spuCode: fav.product.spuCode,
      nameZh: fav.product.nameZh,
      nameEn: fav.product.nameEn,
      nameAr: fav.product.nameAr,
      minPriceSar: fav.product.minPriceSar?.toString() ?? null,
      maxPriceSar: fav.product.maxPriceSar?.toString() ?? null,
      primaryImageUrl: fav.product.images[0]?.url ?? null,
      primaryImageThumbnailUrl: fav.product.images[0]?.thumbnailUrl ?? null,
      gemTypes: fav.product.gemTypes,
      metalColors: fav.product.metalColors,
      favoritedAt: fav.createdAt,
    }))

    return {
      items: formattedItems,
      total: items.length,
      hasMore,
      nextCursor,
    }
  } catch (error) {
    console.error('Failed to get favorite products:', error)
    return { items: [], total: 0, hasMore: false }
  }
}

/**
 * 获取当前用户所有收藏的 productId 数组
 * - 用于批量标记商品是否已收藏
 */
export async function getUserFavoriteIds(): Promise<ApiResponse<{ productIds: string[] }>> {
  try {
    const user = await requireActiveUser()

    const favorites = await prisma.productFavorite.findMany({
      where: { userId: user.id },
      select: { productId: true },
    })

    const productIds = favorites.map(fav => fav.productId)

    return { success: true, data: { productIds } }
  } catch (error) {
    console.error('Failed to get favorite ids:', error)
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Account not activated')) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '获取收藏列表失败' }
  }
}
