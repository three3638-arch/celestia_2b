'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createProductSchema, updateProductSchema } from '@/lib/validations/product'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import { batchTranslate } from '@/lib/excel/translator'
import type { ApiResponse, PaginatedResponse, ProductFilterParams } from '@/types'
import type { Product, ProductSku, ProductImage, Category, GemType, MetalColor, ProductStatus, StockStatus } from '@prisma/client'
import Decimal from 'decimal.js'

// ============================================================
// 辅助函数
// ============================================================

/** Zod 验证错误字段名映射 */
const fieldNameMap: Record<string, string> = {
  spuCode: 'SPU编码',
  nameZh: '中文名称',
  nameEn: '英文名称',
  nameAr: '阿拉伯文名称',
  descriptionZh: '中文描述',
  descriptionEn: '英文描述',
  descriptionAr: '阿拉伯文描述',
  supplier: '供应商',
  supplierLink: '供应商链接',
  categoryId: '品类',
  gemTypes: '宝石类型',
  metalColors: '金属底色',
  skus: 'SKU',
  images: '图片',
  'gemType': '宝石类型',
  'metalColor': '金属底色',
  'mainStoneSize': '主石尺寸',
  'size': '尺寸',
  'chainLength': '链条长度',
  'stockStatus': '库存状态',
  'referencePriceSar': '参考价',
  'url': '图片URL',
  'thumbnailUrl': '缩略图URL',
}

// ============================================================
// 类型定义
// ============================================================

/** 客户端商品列表项 */
export interface ProductListItem {
  id: string
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
}

/** 商品详情 */
export interface ProductDetail {
  id: string
  spuCode: string
  nameZh: string | null
  nameEn: string | null
  nameAr: string | null
  descriptionZh: string | null
  descriptionEn: string | null
  descriptionAr: string | null
  supplier: string | null
  supplierLink: string | null
  gemTypes: GemType[]
  metalColors: MetalColor[]
  status: ProductStatus
  minPriceSar: string | null
  maxPriceSar: string | null
  category: {
    id: string
    nameZh: string
    nameEn: string
    nameAr: string
  }
  skus: {
    id: string
    skuCode: string
    gemType: GemType
    metalColor: MetalColor
    mainStoneSize: string | null
    size: string | null
    chainLength: string | null
    stockStatus: StockStatus
    referencePriceSar: string | null
  }[]
  images: {
    id: string
    url: string
    thumbnailUrl: string | null
    isPrimary: boolean
    sortOrder: number
  }[]
}

/** 管理端商品列表项 */
export interface AdminProductListItem {
  id: string
  spuCode: string
  nameZh: string | null
  supplier: string | null
  supplierLink: string | null
  categoryName: string
  minPriceSar: string | null
  maxPriceSar: string | null
  skuCount: number
  status: ProductStatus
  primaryImageUrl: string | null
  createdAt: Date
}

/** 创建商品输入 */
export interface CreateProductInput {
  spuCode: string
  nameZh: string
  nameEn?: string
  nameAr?: string
  descriptionZh?: string
  descriptionEn?: string
  descriptionAr?: string
  supplier?: string
  supplierLink?: string
  categoryId: string
  gemTypes: GemType[]
  metalColors: MetalColor[]
  skus: {
    gemType: GemType
    metalColor: MetalColor
    mainStoneSize?: string
    size?: string
    chainLength?: string
    stockStatus?: StockStatus
    referencePriceSar?: string
  }[]
  images?: {
    url: string
    thumbnailUrl: string
    isPrimary?: boolean
    sortOrder?: number
  }[]
}

/** 更新商品输入 */
export interface UpdateProductInput {
  nameZh?: string
  nameEn?: string
  nameAr?: string
  descriptionZh?: string
  descriptionEn?: string
  descriptionAr?: string
  supplier?: string
  supplierLink?: string
  categoryId?: string
  gemTypes?: GemType[]
  metalColors?: MetalColor[]
  skus?: {
    id?: string               // 已有 SKU 的 id，用于增量更新
    gemType: GemType
    metalColor: MetalColor
    mainStoneSize?: string
    size?: string
    chainLength?: string
    stockStatus?: StockStatus
    referencePriceSar?: string
  }[]
  images?: {
    url: string
    thumbnailUrl: string
    isPrimary?: boolean
    sortOrder?: number
  }[]
}

// ============================================================
// 辅助函数
// ============================================================

/** 生成 SKU 编码（业务可读式） */
function generateSkuCode(
  spuCode: string,
  sku: { gemType: string; metalColor: string; mainStoneSize?: string | null; size?: string | null; chainLength?: string | null }
): string {
  const GEM_SHORT: Record<string, string> = {
    MOISSANITE: 'MO',
    ZIRCON: 'ZR',
  }
  const METAL_SHORT: Record<string, string> = {
    SILVER: 'SIL',
    GOLD: 'GLD',
    ROSE_GOLD: 'RSG',
    OTHER: 'OTH',
  }

  const parts = [
    spuCode,
    GEM_SHORT[sku.gemType] || sku.gemType,
    METAL_SHORT[sku.metalColor] || sku.metalColor,
  ]
  if (sku.mainStoneSize) parts.push(sku.mainStoneSize.replace(/mm$/i, '') + 'MM')
  if (sku.size) parts.push('S' + sku.size)
  if (sku.chainLength) parts.push('L' + sku.chainLength.replace(/cm$/i, ''))
  return parts.join('-')
}

/** 计算价格区间 */
function calculatePriceRange(skus: { referencePriceSar?: string | null }[]): { min: Decimal | null; max: Decimal | null } {
  const prices = skus
    .map(sku => sku.referencePriceSar)
    .filter((price): price is string => !!price)
    .map(price => new Decimal(price))

  if (prices.length === 0) {
    return { min: null, max: null }
  }

  return {
    min: prices.reduce((min, p) => p.lessThan(min) ? p : min),
    max: prices.reduce((max, p) => p.greaterThan(max) ? p : max),
  }
}

// ============================================================
// 客户端查询
// ============================================================

/**
 * 获取商品列表（游标分页 + 筛选 + 排序）
 * - 自动过滤 status = INACTIVE
 * - 如果用户已登录，自动过滤该用户隐藏的商品
 * - 支持 categoryId, gemType, metalColor, keyword 筛选
 * - keyword 搜索：匹配 nameZh/nameEn/nameAr/spuCode
 * - 排序：price_asc/price_desc(按 minPriceSar), newest(按 createdAt DESC), popular(暂按 createdAt)
 * - 游标分页（cursor = 上一页最后一条记录的 id）
 */
export async function getProducts(
  params: ProductFilterParams
): Promise<PaginatedResponse<ProductListItem>> {
  const { categoryId, gemType, metalColor, keyword, sortBy, cursor, pageSize = 20 } = params

  // 获取当前用户（用于过滤隐藏商品和计算加价比例）
  const user = await getCurrentUser()

  // 计算加价比例：ADMIN 看原始价格，CUSTOMER 用其 markupRatio，未登录用户默认 1.15
  const markupRatio = user?.role === 'ADMIN'
    ? 1
    : user?.role === 'CUSTOMER' && user.markupRatio
      ? parseFloat(user.markupRatio)
      : 1.15

  // 获取用户隐藏的商品ID列表
  let hiddenProductIds: string[] = []
  if (user) {
    const hiddenProducts = await prisma.productHidden.findMany({
      where: { userId: user.id },
      select: { productId: true },
    })
    hiddenProductIds = hiddenProducts.map(h => h.productId)
  }

  // 构建 where 条件
  const where: Record<string, unknown> = {
    status: 'ACTIVE',
  }

  // 过滤用户隐藏的商品
  if (hiddenProductIds.length > 0) {
    where.id = { notIn: hiddenProductIds }
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (gemType) {
    where.gemTypes = { has: gemType }
  }

  if (metalColor) {
    where.metalColors = { has: metalColor }
  }

  if (keyword) {
    where.OR = [
      { nameZh: { contains: keyword, mode: 'insensitive' } },
      { nameEn: { contains: keyword, mode: 'insensitive' } },
      { nameAr: { contains: keyword, mode: 'insensitive' } },
      { spuCode: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  // 构建排序
  let orderBy: Record<string, unknown> = { createdAt: 'desc' }
  if (sortBy === 'price_asc') {
    orderBy = { minPriceSar: 'asc' }
  } else if (sortBy === 'price_desc') {
    orderBy = { minPriceSar: 'desc' }
  } else if (sortBy === 'newest' || sortBy === 'popular') {
    orderBy = { createdAt: 'desc' }
  }

  // 游标条件
  if (cursor) {
    const cursorProduct = await prisma.product.findUnique({
      where: { id: cursor },
      select: { id: true, createdAt: true, minPriceSar: true },
    })

    if (cursorProduct) {
      if (sortBy === 'price_asc') {
        where.OR = [
          { minPriceSar: { gt: cursorProduct.minPriceSar } },
          { minPriceSar: cursorProduct.minPriceSar, id: { gt: cursor } },
        ]
      } else if (sortBy === 'price_desc') {
        where.OR = [
          { minPriceSar: { lt: cursorProduct.minPriceSar } },
          { minPriceSar: cursorProduct.minPriceSar, id: { lt: cursor } },
        ]
      } else {
        where.createdAt = { lt: cursorProduct.createdAt }
      }
    }
  }

  // 查询商品
  const products = await prisma.product.findMany({
    where,
    orderBy,
    take: pageSize + 1, // 多取一条判断是否还有更多
    select: {
      id: true,
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
  })

  const hasMore = products.length > pageSize
  const items = hasMore ? products.slice(0, pageSize) : products
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  // 格式化返回数据（应用加价比例）
  const formattedItems: ProductListItem[] = items.map(product => ({
    id: product.id,
    spuCode: product.spuCode,
    nameZh: product.nameZh,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    minPriceSar: product.minPriceSar
      ? (Math.ceil(parseFloat(product.minPriceSar.toString()) * markupRatio * 10) / 10).toString()
      : null,
    maxPriceSar: product.maxPriceSar
      ? (Math.ceil(parseFloat(product.maxPriceSar.toString()) * markupRatio * 10) / 10).toString()
      : null,
    primaryImageUrl: product.images[0]?.url ?? null,
    primaryImageThumbnailUrl: product.images[0]?.thumbnailUrl ?? null,
    gemTypes: [...product.gemTypes].sort((a, b) => {
      const priority: Record<string, number> = { MOISSANITE: 0, ZIRCON: 1 }
      return (priority[a] ?? 99) - (priority[b] ?? 99)
    }),
    metalColors: product.metalColors,
  }))

  return {
    items: formattedItems,
    total: items.length,
    hasMore,
    nextCursor,
  }
}

/**
 * 获取商品详情
 * - 包含完整信息：商品基础 + 所有 SKU + 所有图片 + 品类信息
 * - 自动过滤 INACTIVE（除非是 ADMIN 查看）
 * - 根据用户加价比例动态计算价格
 */
export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const user = await getCurrentUser()
  const isAdmin = user?.role === 'ADMIN'

  // 计算加价比例：ADMIN 看原始价格，CUSTOMER 用其 markupRatio，未登录用户默认 1.15
  const markupRatio = user?.role === 'ADMIN'
    ? 1
    : user?.role === 'CUSTOMER' && user.markupRatio
      ? parseFloat(user.markupRatio)
      : 1.15

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      ...(isAdmin ? {} : { status: 'ACTIVE' }),
    },
    include: {
      category: {
        select: {
          id: true,
          nameZh: true,
          nameEn: true,
          nameAr: true,
        },
      },
      skus: {
        orderBy: { createdAt: 'asc' },
      },
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!product) {
    return null
  }

  return {
    id: product.id,
    spuCode: product.spuCode,
    nameZh: product.nameZh,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    descriptionZh: product.descriptionZh,
    descriptionEn: product.descriptionEn,
    descriptionAr: product.descriptionAr,
    supplier: product.supplier,
    supplierLink: product.supplierLink,
    gemTypes: [...product.gemTypes].sort((a, b) => {
      const priority: Record<string, number> = { MOISSANITE: 0, ZIRCON: 1 }
      return (priority[a] ?? 99) - (priority[b] ?? 99)
    }),
    metalColors: product.metalColors,
    status: product.status,
    minPriceSar: product.minPriceSar
      ? (Math.ceil(parseFloat(product.minPriceSar.toString()) * markupRatio * 10) / 10).toString()
      : null,
    maxPriceSar: product.maxPriceSar
      ? (Math.ceil(parseFloat(product.maxPriceSar.toString()) * markupRatio * 10) / 10).toString()
      : null,
    category: product.category,
    skus: product.skus.map(sku => ({
      id: sku.id,
      skuCode: sku.skuCode,
      gemType: sku.gemType,
      metalColor: sku.metalColor,
      mainStoneSize: sku.mainStoneSize,
      size: sku.size,
      chainLength: sku.chainLength,
      stockStatus: sku.stockStatus,
      referencePriceSar: sku.referencePriceSar
        ? (Math.ceil(parseFloat(sku.referencePriceSar.toString()) * markupRatio * 10) / 10).toString()
        : null,
    })),
    images: product.images.map(image => ({
      id: image.id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    })),
  }
}

// ============================================================
// 管理端操作
// ============================================================

/**
 * 创建商品
 * - 验证 ADMIN 权限
 * - 使用 createProductSchema 验证
 * - 事务内创建 Product + SKUs + Images
 * - 自动计算 minPriceSar 和 maxPriceSar
 */
export async function createProduct(
  data: CreateProductInput
): Promise<ApiResponse<{ id: string }>> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    // 验证输入数据
    const validation = createProductSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, fieldNameMap) }
    }

    const validatedData = validation.data

    // 计算价格区间
    const { min, max } = calculatePriceRange(validatedData.skus)

    // 自动翻译：收集需要翻译的文本
    const textsToTranslate: string[] = []
    const textIndices: { nameIndex?: number; descIndex?: number } = {}

    // 如果用户未填写英文或阿拉伯文名称，需要翻译
    const needsNameTranslation = !validatedData.nameEn || !validatedData.nameAr
    // 如果用户未填写英文或阿拉伯文描述，需要翻译
    const needsDescTranslation = !validatedData.descriptionEn || !validatedData.descriptionAr

    if (needsNameTranslation) {
      // 使用 nameZh 或 spuCode 作为翻译源
      const nameSource = validatedData.nameZh || validatedData.spuCode
      textIndices.nameIndex = textsToTranslate.length
      textsToTranslate.push(nameSource)
    }

    if (needsDescTranslation && validatedData.descriptionZh) {
      textIndices.descIndex = textsToTranslate.length
      textsToTranslate.push(validatedData.descriptionZh)
    }

    // 执行翻译
    let translations: { en: string; ar: string }[] = []
    if (textsToTranslate.length > 0) {
      try {
        translations = await batchTranslate(textsToTranslate)
      } catch (error) {
        console.error('[createProduct] Translation failed:', error)
        // 翻译失败使用 fallback
        translations = textsToTranslate.map(text => ({
          en: `[EN] ${text}`,
          ar: `[AR] ${text}`,
        }))
      }
    }

    // 获取翻译结果（用户已填写的字段优先）
    const nameTranslation = textIndices.nameIndex !== undefined ? translations[textIndices.nameIndex] : undefined
    const descTranslation = textIndices.descIndex !== undefined ? translations[textIndices.descIndex] : undefined

    const finalNameEn = validatedData.nameEn || (nameTranslation?.en ?? '')
    const finalNameAr = validatedData.nameAr || (nameTranslation?.ar ?? '')
    const finalDescEn = validatedData.descriptionEn || (descTranslation?.en ?? '')
    const finalDescAr = validatedData.descriptionAr || (descTranslation?.ar ?? '')

    // 事务内创建商品
    const product = await prisma.$transaction(async (tx) => {
      // 创建商品
      const newProduct = await tx.product.create({
        data: {
          spuCode: validatedData.spuCode,
          nameZh: validatedData.nameZh,
          nameEn: finalNameEn,
          nameAr: finalNameAr,
          descriptionZh: validatedData.descriptionZh,
          descriptionEn: finalDescEn,
          descriptionAr: finalDescAr,
          supplier: validatedData.supplier,
          supplierLink: validatedData.supplierLink,
          categoryId: validatedData.categoryId,
          gemTypes: validatedData.gemTypes,
          metalColors: validatedData.metalColors,
          minPriceSar: min,
          maxPriceSar: max,
          status: 'ACTIVE',
        },
      })

      // 创建 SKUs
      if (validatedData.skus.length > 0) {
        await tx.productSku.createMany({
          data: validatedData.skus.map((sku) => ({
            productId: newProduct.id,
            skuCode: generateSkuCode(validatedData.spuCode, sku),
            gemType: sku.gemType,
            metalColor: sku.metalColor,
            mainStoneSize: sku.mainStoneSize,
            size: sku.size,
            chainLength: sku.chainLength,
            stockStatus: sku.stockStatus ?? 'IN_STOCK',
            referencePriceSar: sku.referencePriceSar ? new Decimal(sku.referencePriceSar) : null,
          })),
        })
      }

      // 创建图片
      if (validatedData.images && validatedData.images.length > 0) {
        await tx.productImage.createMany({
          data: validatedData.images.map((image, index) => ({
            productId: newProduct.id,
            url: image.url,
            thumbnailUrl: image.thumbnailUrl,
            isPrimary: image.isPrimary ?? index === 0, // 默认第一张为主图
            sortOrder: image.sortOrder ?? index,
          })),
        })
      }

      return newProduct
    })

    return { success: true, data: { id: product.id } }
  } catch (error) {
    console.error('Failed to create product:', error)
    return { success: false, error: 'Failed to create product' }
  }
}

/**
 * 更新商品
 * - 验证 ADMIN 权限
 * - 更新基础信息
 * - 如果传入 skus，执行增量更新（而非全删重建）
 *   - 有 id 且存在 → 更新
 *   - 无 id → 新增
 *   - 已有但未传 → 安全删除（被订单引用的保留）
 * - 如果传入 images，删除旧图片并重建
 * - 重新计算价格区间
 */
export async function updateProduct(
  productId: string,
  data: UpdateProductInput
): Promise<ApiResponse> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    // 验证输入数据
    const validation = updateProductSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, fieldNameMap) }
    }

    const validatedData = validation.data

    // 获取原商品信息（用于 SKU 编码生成和翻译源）
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { spuCode: true, nameZh: true, descriptionZh: true },
    })

    if (!existingProduct) {
      return { success: false, error: 'Product not found' }
    }

    // 自动翻译：收集需要翻译的文本
    const textsToTranslate: string[] = []
    const textIndices: { nameIndex?: number; descIndex?: number } = {}

    // 如果用户未填写英文或阿拉伯文名称，需要翻译
    const needsNameTranslation = validatedData.nameEn === '' || validatedData.nameAr === '' ||
      (validatedData.nameEn === undefined && validatedData.nameAr === undefined)
    // 如果用户未填写英文或阿拉伯文描述，需要翻译
    const needsDescTranslation = validatedData.descriptionEn === '' || validatedData.descriptionAr === '' ||
      (validatedData.descriptionEn === undefined && validatedData.descriptionAr === undefined)

    // 确定名称翻译源：优先使用传入的 nameZh，否则使用现有的 nameZh 或 spuCode
    const nameSource = validatedData.nameZh || existingProduct.nameZh || existingProduct.spuCode
    // 确定描述翻译源：优先使用传入的 descriptionZh，否则使用现有的 descriptionZh
    const descSource = validatedData.descriptionZh || existingProduct.descriptionZh

    if (needsNameTranslation) {
      textIndices.nameIndex = textsToTranslate.length
      textsToTranslate.push(nameSource)
    }

    if (needsDescTranslation && descSource) {
      textIndices.descIndex = textsToTranslate.length
      textsToTranslate.push(descSource)
    }

    // 执行翻译
    let translations: { en: string; ar: string }[] = []
    if (textsToTranslate.length > 0) {
      try {
        translations = await batchTranslate(textsToTranslate)
      } catch (error) {
        console.error('[updateProduct] Translation failed:', error)
        // 翻译失败使用 fallback
        translations = textsToTranslate.map(text => ({
          en: `[EN] ${text}`,
          ar: `[AR] ${text}`,
        }))
      }
    }

    // 获取翻译结果
    const nameTranslation = textIndices.nameIndex !== undefined ? translations[textIndices.nameIndex] : undefined
    const descTranslation = textIndices.descIndex !== undefined ? translations[textIndices.descIndex] : undefined

    // 事务内更新商品
    await prisma.$transaction(async (tx) => {
      // 准备更新数据
      const updateData: Record<string, unknown> = {}

      if (validatedData.nameZh !== undefined) updateData.nameZh = validatedData.nameZh
      // 名称：用户显式填写的优先，否则使用翻译结果
      if (validatedData.nameEn !== undefined) {
        updateData.nameEn = validatedData.nameEn || (nameTranslation?.en ?? '')
      }
      if (validatedData.nameAr !== undefined) {
        updateData.nameAr = validatedData.nameAr || (nameTranslation?.ar ?? '')
      }
      if (validatedData.descriptionZh !== undefined) updateData.descriptionZh = validatedData.descriptionZh
      // 描述：用户显式填写的优先，否则使用翻译结果
      if (validatedData.descriptionEn !== undefined) {
        updateData.descriptionEn = validatedData.descriptionEn || (descTranslation?.en ?? '')
      }
      if (validatedData.descriptionAr !== undefined) {
        updateData.descriptionAr = validatedData.descriptionAr || (descTranslation?.ar ?? '')
      }
      if (validatedData.supplier !== undefined) updateData.supplier = validatedData.supplier
      if (validatedData.supplierLink !== undefined) updateData.supplierLink = validatedData.supplierLink
      if (validatedData.categoryId !== undefined) updateData.categoryId = validatedData.categoryId
      if (validatedData.gemTypes !== undefined) updateData.gemTypes = validatedData.gemTypes
      if (validatedData.metalColors !== undefined) updateData.metalColors = validatedData.metalColors

      // 如果有新的 SKUs，计算价格区间并更新
      if (validatedData.skus && validatedData.skus.length > 0) {
        const { min, max } = calculatePriceRange(validatedData.skus)
        updateData.minPriceSar = min
        updateData.maxPriceSar = max
      }

      // 更新商品基础信息
      await tx.product.update({
        where: { id: productId },
        data: updateData,
      })

      // 如果传入 skus，执行增量更新
      if (validatedData.skus && validatedData.skus.length > 0) {
        // 1. 获取当前数据库中该商品的所有 SKU
        const existingSkus = await tx.productSku.findMany({
          where: { productId },
          select: { id: true },
        })
        const existingSkuIds = new Set(existingSkus.map(s => s.id))

        // 2. 分类：有 id 且存在 → 更新；无 id → 新增；存在但未传 → 待删除
        const skusToUpdate = validatedData.skus.filter(sku => sku.id && existingSkuIds.has(sku.id))
        const skusToCreate = validatedData.skus.filter(sku => !sku.id)
        const submittedIds = new Set(validatedData.skus.filter(sku => sku.id).map(sku => sku.id!))
        const skuIdsToDelete = existingSkus.map(s => s.id).filter(id => !submittedIds.has(id))

        // 3. 更新已有 SKU
        for (const sku of skusToUpdate) {
          await tx.productSku.update({
            where: { id: sku.id },
            data: {
              gemType: sku.gemType,
              metalColor: sku.metalColor,
              mainStoneSize: sku.mainStoneSize,
              size: sku.size,
              chainLength: sku.chainLength,
              stockStatus: sku.stockStatus ?? 'IN_STOCK',
              referencePriceSar: sku.referencePriceSar ? new Decimal(sku.referencePriceSar) : null,
            },
          })
        }

        // 4. 新增 SKU
        if (skusToCreate.length > 0) {
          // 获取该商品所有已存在的 sku_code（包括被订单引用保留的）
          const allExistingSkuCodes = await tx.productSku.findMany({
            where: { productId },
            select: { skuCode: true },
          })
          const usedCodes = new Set(allExistingSkuCodes.map(s => s.skuCode))

          // 生成唯一 sku_code：如果冲突则追加序号
          const generateUniqueSkuCode = (
            spuCode: string,
            sku: { gemType: string; metalColor: string; mainStoneSize?: string | null; size?: string | null; chainLength?: string | null }
          ): string => {
            let baseCode = generateSkuCode(spuCode, sku)
            let code = baseCode
            let suffix = 1
            while (usedCodes.has(code)) {
              code = `${baseCode}-${suffix}`
              suffix++
            }
            usedCodes.add(code)
            return code
          }

          await tx.productSku.createMany({
            data: skusToCreate.map((sku) => ({
              productId,
              skuCode: generateUniqueSkuCode(existingProduct.spuCode, sku),
              gemType: sku.gemType,
              metalColor: sku.metalColor,
              mainStoneSize: sku.mainStoneSize,
              size: sku.size,
              chainLength: sku.chainLength,
              stockStatus: sku.stockStatus ?? 'IN_STOCK',
              referencePriceSar: sku.referencePriceSar ? new Decimal(sku.referencePriceSar) : null,
            })),
          })
        }

        // 5. 删除不再需要的 SKU（仅删除未被订单引用的）
        if (skuIdsToDelete.length > 0) {
          const referencedSkuIds = await tx.orderItem.findMany({
            where: { skuId: { in: skuIdsToDelete } },
            select: { skuId: true },
            distinct: ['skuId'],
          })
          const referencedIds = new Set(referencedSkuIds.map(r => r.skuId))

          const safeToDelete = skuIdsToDelete.filter(id => !referencedIds.has(id))
          if (safeToDelete.length > 0) {
            await tx.productSku.deleteMany({
              where: { id: { in: safeToDelete } },
            })
          }
          // 被订单引用的 SKU 保留在数据库中，确保订单历史数据完整性
        }
      }

      // 如果传入 images，删除旧图片并重建
      if (validatedData.images && validatedData.images.length > 0) {
        await tx.productImage.deleteMany({
          where: { productId },
        })

        await tx.productImage.createMany({
          data: validatedData.images.map((image, index) => ({
            productId,
            url: image.url,
            thumbnailUrl: image.thumbnailUrl,
            isPrimary: image.isPrimary ?? index === 0,
            sortOrder: image.sortOrder ?? index,
          })),
        })
      }
    })

    return { success: true, message: 'Product updated successfully' }
  } catch (error) {
    console.error('Failed to update product:', error)
    return { success: false, error: 'Failed to update product' }
  }
}

/**
 * 切换上下架
 * - 验证 ADMIN 权限
 * - ACTIVE ↔ INACTIVE 切换
 */
export async function toggleProductStatus(productId: string): Promise<ApiResponse> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { status: true },
    })

    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

    await prisma.product.update({
      where: { id: productId },
      data: { status: newStatus },
    })

    return { success: true, message: `Product is now ${newStatus}` }
  } catch (error) {
    console.error('Failed to toggle product status:', error)
    return { success: false, error: 'Failed to toggle product status' }
  }
}

/**
 * 删除商品
 * - 验证 ADMIN 权限
 * - 检查是否有关联的未完成订单项，如有则拒绝删除
 * - 硬删除（级联删除 SKUs + Images）
 */
export async function deleteProduct(productId: string): Promise<ApiResponse> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    // 检查是否有关联的未完成订单项
    const incompleteOrderItems = await prisma.orderItem.findFirst({
      where: {
        sku: {
          productId,
        },
        order: {
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      },
    })

    if (incompleteOrderItems) {
      return { success: false, error: 'Cannot delete product with incomplete orders' }
    }

    // 删除商品（级联删除 SKUs 和 Images）
    await prisma.product.delete({
      where: { id: productId },
    })

    return { success: true, message: 'Product deleted successfully' }
  } catch (error) {
    console.error('Failed to delete product:', error)
    return { success: false, error: 'Failed to delete product' }
  }
}

/**
 * 更新 SKU 库存状态
 * - 验证 ADMIN 权限
 * - 更新 stockStatus
 */
export async function updateSkuStock(skuId: string, status: StockStatus): Promise<ApiResponse> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    await prisma.productSku.update({
      where: { id: skuId },
      data: { stockStatus: status },
    })

    return { success: true, message: 'SKU stock status updated successfully' }
  } catch (error) {
    console.error('Failed to update SKU stock status:', error)
    return { success: false, error: 'Failed to update SKU stock status' }
  }
}

/**
 * 获取管理端商品列表（含 INACTIVE）
 * - 不过滤 INACTIVE
 * - 额外返回：skuCount, status, createdAt
 */
export async function getAdminProducts(params: {
  page?: number
  pageSize?: number
  search?: string
  categoryId?: string
  status?: string
}): Promise<PaginatedResponse<AdminProductListItem>> {
  try {
    // 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { items: [], total: 0, hasMore: false }
    }

    const { page = 1, pageSize = 20, search, categoryId, status } = params
    const skip = (page - 1) * pageSize

    // 构建 where 条件
    const where: Record<string, unknown> = {}

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { nameZh: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { spuCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.product.count({ where })

    // 查询商品
    const products = await prisma.product.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { nameZh: true },
        },
        skus: {
          select: { id: true },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { url: true, thumbnailUrl: true },
        },
      },
    })

    const hasMore = skip + products.length < total

    // 格式化返回数据
    const items: AdminProductListItem[] = products.map(product => ({
      id: product.id,
      spuCode: product.spuCode,
      nameZh: product.nameZh,
      supplier: product.supplier,
      supplierLink: product.supplierLink,
      categoryName: product.category.nameZh,
      minPriceSar: product.minPriceSar?.toString() ?? null,
      maxPriceSar: product.maxPriceSar?.toString() ?? null,
      skuCount: product.skus.length,
      status: product.status,
      primaryImageUrl:
        product.images[0]?.thumbnailUrl || product.images[0]?.url || null,
      createdAt: product.createdAt,
    }))

    return {
      items,
      total,
      hasMore,
    }
  } catch (error) {
    console.error('Failed to get admin products:', error)
    return { items: [], total: 0, hasMore: false }
  }
}
