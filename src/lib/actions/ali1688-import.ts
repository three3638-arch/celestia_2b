'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { querySellerOfferList, queryProductDetail } from '@/lib/ali1688/api'
import { processImage } from '@/lib/image'
import { uploadToR2, generateFileKey } from '@/lib/r2'
import { batchTranslate } from '@/lib/excel/translator'
import type { ProductDetail as Ali1688ProductDetail } from '@/lib/ali1688/types'
import type { GemType, MetalColor } from '@prisma/client'
import Decimal from 'decimal.js'

// ============================================================
// 类型定义
// ============================================================

export interface Fetch1688Params {
  /** 该供应商任意一件商品的 1688 商品ID（offerId）；后端会用它反查出 sellerOpenId */
  referenceOfferId: string
  maxCount: number
}

export interface CategoryMapping {
  categoryId: number
  categoryName: string
  productCount: number
  attributes: string[]
}

export interface Fetch1688Result {
  success: boolean
  error?: string
  data?: {
    products: Ali1688ProductDetail[]
    categoryMappings: CategoryMapping[]
    promotionUrls?: Record<number, string>
    /** 由 referenceOfferId 反查出的供应商 OpenID，UI 需保留并在入库时回传 */
    sellerOpenId: string
    /** 由商详返回的公司名称，UI 可用来自动填充供应商名称建议 */
    companyName?: string
  }
}

export type SystemAttributeField =
  | 'gemType'
  | 'metalColor'
  | 'mainStoneSize'
  | 'size'
  | 'chainLength'
  | 'ignore'

export interface Import1688Params {
  products: Ali1688ProductDetail[]
  attributeMapping: Record<string, string>  // 1688属性名 → 系统属性字段名
  spuPrefix: string
  supplierName: string
  sellerOpenId: string
  exchangeRate: number
  promotionUrls?: Record<number, string>
}

export interface Import1688Result {
  success: boolean
  error?: string
  importedProducts?: number
  importedSkus?: number
  errors?: { offerId: number; error: string }[]
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 价格转换: CNY → SAR，1位小数向上取整
 */
function convertCnyToSar(cnyPrice: string, exchangeRate: number): number {
  const cny = parseFloat(cnyPrice)
  if (isNaN(cny)) return 0
  return Math.ceil(cny * exchangeRate * 10) / 10
}

/**
 * 下载远程图片
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    // 确保 https 协议
    const httpsUrl = url.replace(/^http:/, 'https:')
    const response = await fetch(httpsUrl, {
      signal: AbortSignal.timeout(15000), // 15秒超时
    })
    if (!response.ok) return null
    return Buffer.from(await response.arrayBuffer())
  } catch {
    return null
  }
}

/**
 * 生成下一个SPU编号
 * 查询DB中以 {prefix}- 开头的最大spuCode，从下一个序号开始
 * 格式: {prefix}-{6位数字零填充}
 */
async function getNextSpuCode(prefix: string): Promise<string> {
  const lastProduct = await prisma.product.findFirst({
    where: {
      spuCode: { startsWith: `${prefix}-` },
    },
    orderBy: { spuCode: 'desc' },
    select: { spuCode: true },
  })

  let nextSeq = 1
  if (lastProduct) {
    // 从 spuCode 中提取序号部分
    const parts = lastProduct.spuCode.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1
    }
  }

  return `${prefix}-${String(nextSeq).padStart(6, '0')}`
}

/**
 * 并发池 — 控制最大并发数
 */
async function promisePool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  let index = 0

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++
      try {
        results[currentIndex] = await fn(items[currentIndex])
      } catch (error) {
        // 单个失败不中断，返回 null 表示失败
        console.error(`[promisePool] Item ${currentIndex} failed:`, error)
        results[currentIndex] = null as unknown as R
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

/**
 * 将1688属性值映射到 GemType 枚举
 */
function mapToGemType(value: string): GemType {
  const normalized = value.toLowerCase().trim()
  if (normalized.includes('moissan') || normalized.includes('莫桑')) {
    return 'MOISSANITE'
  }
  // 默认锆石
  return 'ZIRCON'
}

/**
 * 将1688属性值映射到 MetalColor 枚举
 */
function mapToMetalColor(value: string): MetalColor {
  const normalized = value.toLowerCase().trim()
  if (normalized.includes('gold') && normalized.includes('rose')) {
    return 'ROSE_GOLD'
  }
  if (normalized.includes('gold') || normalized.includes('金')) {
    return 'GOLD'
  }
  if (normalized.includes('silver') || normalized.includes('银') || normalized.includes('white')) {
    return 'SILVER'
  }
  // 默认OTHER
  return 'OTHER'
}

/**
 * 从 OfferListItem 列表中获取 promotionURL 映射
 */
function buildPromotionUrlMap(
  offerItems: { offerId: number; promotionURL?: string }[]
): Map<number, string> {
  const map = new Map<number, string>()
  for (const item of offerItems) {
    if (item.promotionURL) {
      map.set(item.offerId, item.promotionURL)
    }
  }
  return map
}

// ============================================================
// Server Actions
// ============================================================

/**
 * 获取1688商品清单 + 详情
 *
 * 1. 权限检查（仅ADMIN）
 * 2. 分页调用 querySellerOfferList
 * 3. 并发调用 queryProductDetail（最多5并发）
 * 4. 按 categoryId 分组生成 CategoryMapping
 * 5. 返回商品详情和类目映射
 */
export async function fetchProductsFrom1688(
  params: Fetch1688Params
): Promise<Fetch1688Result> {
  try {
    // 1. 权限检查
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const { referenceOfferId, maxCount } = params
    if (!referenceOfferId) {
      return { success: false, error: '请输入任一商品ID' }
    }
    const refOfferIdNum = Number(referenceOfferId)
    if (!Number.isFinite(refOfferIdNum) || refOfferIdNum <= 0) {
      return { success: false, error: '商品ID必须是有效的数字' }
    }
    if (!maxCount || maxCount <= 0) {
      return { success: false, error: 'maxCount must be positive' }
    }

    // 2. 用商品ID反查供应商 OpenID（1688 同店搜索的 sellerOpenId 必须经此反查获得）
    console.log('[fetch1688] reverse-lookup start, offerId=', refOfferIdNum)
    let refDetailResp
    try {
      refDetailResp = await queryProductDetail(refOfferIdNum)
    } catch (e) {
      console.error('[fetch1688] queryProductDetail threw:', e)
      return {
        success: false,
        error: `调用1688商详接口异常：${e instanceof Error ? e.message : String(e)}`,
      }
    }
    console.log(
      '[fetch1688] reverse-lookup raw response:',
      JSON.stringify(refDetailResp).slice(0, 1500)
    )
    if (!refDetailResp.success || !refDetailResp.result) {
      console.error(
        '[fetch1688] reverse-lookup failed: success=',
        refDetailResp.success,
        'message=',
        refDetailResp.message
      )
      return {
        success: false,
        error:
          refDetailResp.message ||
          '无法获取该商品的详情，请检查商品ID是否正确',
      }
    }
    const sellerOpenId = refDetailResp.result.sellerOpenId
    const companyName = refDetailResp.result.companyName
    console.log(
      '[fetch1688] reverse-lookup ok, sellerOpenId=',
      sellerOpenId,
      'companyName=',
      companyName
    )
    if (!sellerOpenId) {
      return {
        success: false,
        error: '商品详情中未返回供应商OpenID，无法继续获取同店商品',
      }
    }

    // 3. 分页获取商品清单
    const PAGE_SIZE = 20
    let currentPage = 1
    let hasMore = true
    const allOfferItems: { offerId: number; promotionURL?: string }[] = []

    while (hasMore && allOfferItems.length < maxCount) {
      const listResponse = await querySellerOfferList(
        sellerOpenId,
        currentPage,
        PAGE_SIZE
      )

      if (!listResponse.success || !listResponse.result) {
        return {
          success: false,
          error: listResponse.message || 'Failed to fetch seller offer list',
        }
      }

      const { data, totalPage } = listResponse.result

      for (const item of data) {
        allOfferItems.push({
          offerId: item.offerId,
          promotionURL: item.promotionURL,
        })
        if (allOfferItems.length >= maxCount) break
      }

      hasMore = currentPage < totalPage && data.length > 0
      currentPage++
    }

    if (allOfferItems.length === 0) {
      return {
        success: true,
        data: {
          products: [],
          categoryMappings: [],
          sellerOpenId,
          companyName,
        },
      }
    }

    // 3. 并发获取商品详情（最多5并发）
    const offerIds = allOfferItems.map(item => item.offerId)
    const productDetails = await promisePool(
      offerIds,
      async (offerId) => {
        const detailResponse = await queryProductDetail(offerId)
        if (!detailResponse.success || !detailResponse.result) {
          console.error(`[fetch1688] Failed to get detail for offer ${offerId}: ${detailResponse.message}`)
          return null
        }
        return detailResponse.result
      },
      5
    )

    // 过滤掉失败的请求，构建 promotionURL 映射
    const promotionUrlMap = buildPromotionUrlMap(allOfferItems)
    const promotionUrls: Record<number, string> = {}
    for (const [offerId, url] of promotionUrlMap.entries()) {
      promotionUrls[offerId] = url
    }

    const validProducts: Ali1688ProductDetail[] = []

    for (const detail of productDetails) {
      if (detail) {
        validProducts.push(detail)
      }
    }

    // 4. 按 categoryId 分组，生成 CategoryMapping
    const categoryMap = new Map<number, CategoryMapping>()

    for (const product of validProducts) {
      const catId = product.categoryId ?? 0
      const catName = product.categoryName ?? 'Unknown'

      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          categoryId: catId,
          categoryName: catName,
          productCount: 0,
          attributes: [],
        })
      }

      const mapping = categoryMap.get(catId)!
      mapping.productCount++

      // 收集该商品所有 SKU 的属性名
      if (product.productSkuInfos) {
        const attrNames = new Set<string>()
        for (const sku of product.productSkuInfos) {
          if (sku.skuAttributes) {
            for (const attr of sku.skuAttributes) {
              // 优先使用翻译后的属性名
              attrNames.add(attr.attributeNameTrans || attr.attributeName)
            }
          }
        }
        // 合并去重
        for (const name of attrNames) {
          if (!mapping.attributes.includes(name)) {
            mapping.attributes.push(name)
          }
        }
      }
    }

    return {
      success: true,
      data: {
        products: validProducts,
        categoryMappings: Array.from(categoryMap.values()),
        promotionUrls,
        sellerOpenId,
        companyName,
      },
    }
  } catch (error) {
    console.error('[fetchProductsFrom1688] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch products from 1688',
    }
  }
}

/**
 * 确认映射后，将1688商品入库
 *
 * 1. 权限检查（仅ADMIN）
 * 2. 生成SPU编号序列
 * 3. 遍历每个商品：下载图片、映射SKU属性、价格转换
 * 4. 事务入库
 * 5. 返回导入统计
 */
export async function importProductsFrom1688(
  params: Import1688Params
): Promise<Import1688Result> {
  try {
    // 1. 权限检查
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const {
      products,
      attributeMapping,
      spuPrefix,
      supplierName,
      sellerOpenId,
      exchangeRate = 0.5814,
      promotionUrls,
    } = params

    if (!products || products.length === 0) {
      return { success: false, error: 'No products to import' }
    }

    // 2. 查询默认品类（使用"戒指"品类，如果没有则取第一个）
    let defaultCategoryId: string | null = null
    const ringCategory = await prisma.category.findFirst({
      where: { nameZh: '戒指' },
      select: { id: true },
    })
    if (ringCategory) {
      defaultCategoryId = ringCategory.id
    } else {
      const firstCategory = await prisma.category.findFirst({
        select: { id: true },
      })
      defaultCategoryId = firstCategory?.id ?? null
    }

    if (!defaultCategoryId) {
      return { success: false, error: 'No product category found in database' }
    }

    // 3. 生成起始SPU编号
    let nextSpuCode = await getNextSpuCode(spuPrefix)

    // 4. 遍历每个商品
    const errors: { offerId: number; error: string }[] = []
    let importedProducts = 0
    let importedSkus = 0

    for (const product of products) {
      try {
        const spuCode = nextSpuCode
        // 递增SPU编号
        const nextSeq = parseInt(spuCode.split('-').pop() ?? '0', 10) + 1
        nextSpuCode = `${spuPrefix}-${String(nextSeq).padStart(6, '0')}`

        // a. nameZh = spuCode（后续可由管理员修改）
        const nameZh = spuCode

        // b. 下载并处理主图
        let imageUrl: string | null = null
        let thumbnailUrl: string | null = null
        const primaryImageUrl =
          product.productImage?.images?.[0] || product.productImage?.whiteImage

        if (primaryImageUrl) {
          const imageBuffer = await downloadImage(primaryImageUrl)
          if (imageBuffer) {
            try {
              const processed = await processImage(imageBuffer)

              // 上传原图
              const originalKey = generateFileKey('products', 'webp')
              imageUrl = await uploadToR2({
                key: originalKey,
                body: processed.original,
                contentType: 'image/webp',
              })

              // 上传缩略图
              const thumbKey = generateFileKey('products/thumbnails', 'webp')
              thumbnailUrl = await uploadToR2({
                key: thumbKey,
                body: processed.thumbnail,
                contentType: 'image/webp',
              })
            } catch (imgError) {
              console.error(
                `[import1688] Image processing failed for ${spuCode}:`,
                imgError
              )
              // 图片处理失败，跳过图片
            }
          }
        }

        // c. 处理SKU
        const skuItems = product.productSkuInfos ?? []
        const processedSkus: {
          skuCode: string
          gemType: GemType
          metalColor: MetalColor
          mainStoneSize: string | null
          size: string | null
          chainLength: string | null
          referencePriceSar: number
          ali1688SkuId: string
        }[] = []

        const gemTypesSet = new Set<GemType>()
        const metalColorsSet = new Set<MetalColor>()
        let minPrice = Infinity
        let maxPrice = -Infinity

        for (let skuIdx = 0; skuIdx < skuItems.length; skuIdx++) {
          const sku = skuItems[skuIdx]

          // 根据attributeMapping映射SKU属性
          let gemType: GemType = 'ZIRCON'
          let metalColor: MetalColor = 'SILVER'
          let mainStoneSize: string | null = null
          let size: string | null = null
          let chainLength: string | null = null

          if (sku.skuAttributes) {
            for (const attr of sku.skuAttributes) {
              const attrName = attr.attributeNameTrans || attr.attributeName
              const mappedField = attributeMapping[attrName]

              if (!mappedField || mappedField === 'ignore') continue

              const attrValue = attr.valueTrans || attr.value

              switch (mappedField) {
                case 'gemType':
                  gemType = mapToGemType(attrValue)
                  break
                case 'metalColor':
                  metalColor = mapToMetalColor(attrValue)
                  break
                case 'mainStoneSize':
                  mainStoneSize = attrValue
                  break
                case 'size':
                  size = attrValue
                  break
                case 'chainLength':
                  chainLength = attrValue
                  break
              }
            }
          }

          // 价格转换
          const priceSar = convertCnyToSar(sku.price ?? '0', exchangeRate)

          gemTypesSet.add(gemType)
          metalColorsSet.add(metalColor)

          if (priceSar > 0) {
            if (priceSar < minPrice) minPrice = priceSar
            if (priceSar > maxPrice) maxPrice = priceSar
          }

          processedSkus.push({
            skuCode: `${spuCode}-${skuIdx + 1}`,
            gemType,
            metalColor,
            mainStoneSize,
            size,
            chainLength,
            referencePriceSar: priceSar,
            ali1688SkuId: String(sku.skuId),
          })
        }

        // 如果没有SKU，至少创建一个默认SKU
        if (processedSkus.length === 0) {
          const priceSar = convertCnyToSar(
            product.productSaleInfo?.priceRangeList?.[0]?.price ?? '0',
            exchangeRate
          )

          if (priceSar > 0) {
            minPrice = priceSar
            maxPrice = priceSar
          }

          processedSkus.push({
            skuCode: `${spuCode}-1`,
            gemType: 'ZIRCON',
            metalColor: 'SILVER',
            mainStoneSize: null,
            size: null,
            chainLength: null,
            referencePriceSar: priceSar,
            ali1688SkuId: '',
          })

          gemTypesSet.add('ZIRCON')
          metalColorsSet.add('SILVER')
        }

        // d. 计算价格区间
        const minPriceSar = minPrice !== Infinity ? minPrice : null
        const maxPriceSar = maxPrice !== -Infinity ? maxPrice : null

        // e. 自动翻译名称
        let nameEn = ''
        let nameAr = ''
        try {
          const translations = await batchTranslate([
            product.subject || spuCode,
          ])
          nameEn = translations[0]?.en || ''
          nameAr = translations[0]?.ar || ''
        } catch (error) {
          console.error('[import1688] Translation failed:', error)
          nameEn = product.subjectTrans || ''
          nameAr = ''
        }

        // 4. 事务入库
        await prisma.$transaction(async (tx) => {
          // 检查是否已通过 ali1688ProductId 存在（幂等）
          const existing = await tx.product.findFirst({
            where: { ali1688ProductId: String(product.offerId) },
            select: { id: true },
          })

          if (existing) {
            throw new Error(`Product with ali1688ProductId ${product.offerId} already exists`)
          }

          // 创建商品
          const newProduct = await tx.product.create({
            data: {
              spuCode,
              nameZh,
              nameEn,
              nameAr,
              categoryId: defaultCategoryId!,
              supplier: supplierName,
              supplierLink: promotionUrls?.[product.offerId] || product.subject || null,
              ali1688ProductId: String(product.offerId),
              ali1688SupplierId: sellerOpenId,
              gemTypes: Array.from(gemTypesSet),
              metalColors: Array.from(metalColorsSet),
              minPriceSar: minPriceSar !== null ? new Decimal(minPriceSar) : null,
              maxPriceSar: maxPriceSar !== null ? new Decimal(maxPriceSar) : null,
              status: 'ACTIVE',
            },
          })

          // 创建 SKUs
          if (processedSkus.length > 0) {
            await tx.productSku.createMany({
              data: processedSkus.map((sku) => ({
                productId: newProduct.id,
                skuCode: sku.skuCode,
                gemType: sku.gemType,
                metalColor: sku.metalColor,
                mainStoneSize: sku.mainStoneSize,
                size: sku.size,
                chainLength: sku.chainLength,
                referencePriceSar:
                  sku.referencePriceSar > 0
                    ? new Decimal(sku.referencePriceSar)
                    : null,
                stockStatus: 'IN_STOCK',
                ali1688SkuId: sku.ali1688SkuId || null,
              })),
            })
          }

          // 创建图片
          if (imageUrl) {
            await tx.productImage.create({
              data: {
                productId: newProduct.id,
                url: imageUrl,
                thumbnailUrl: thumbnailUrl || null,
                isPrimary: true,
                sortOrder: 0,
              },
            })
          }
        })

        importedProducts++
        importedSkus += processedSkus.length
      } catch (error) {
        console.error(
          `[import1688] Failed to import product ${product.offerId}:`,
          error
        )
        errors.push({
          offerId: product.offerId,
          error:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      success: true,
      importedProducts,
      importedSkus,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error('[importProductsFrom1688] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to import products from 1688',
    }
  }
}

// ============================================================
// 1688 同步 Server Action
// ============================================================

export interface Sync1688Params {
  sellerOpenId: string
  exchangeRate: number
}

export interface Sync1688Result {
  success: boolean
  error?: string
  stats?: {
    totalProducts: number
    updatedProducts: number
    delistedProducts: number
    updatedSkus: number
    delistedSkus: number
    failedProducts: number
  }
}

/**
 * 同步1688商品价格 & 下架已删除商品
 *
 * 1. ADMIN权限检查
 * 2. 查询DB中该供应商的所有商品（含SKU）
 * 3. 分页获取1688当前在售商品清单
 * 4. 对比处理：下架缺失商品、更新价格
 * 5. 返回同步统计
 */
export async function syncProductsFrom1688(
  params: Sync1688Params
): Promise<Sync1688Result> {
  try {
    // 1. 权限检查
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const { sellerOpenId, exchangeRate = 0.5814 } = params
    if (!sellerOpenId) {
      return { success: false, error: 'sellerOpenId is required' }
    }

    // 2. 查询DB中该供应商的所有商品（含SKU）
    const dbProducts = await prisma.product.findMany({
      where: { ali1688SupplierId: sellerOpenId },
      include: { skus: true },
    })

    if (dbProducts.length === 0) {
      return {
        success: true,
        stats: {
          totalProducts: 0,
          updatedProducts: 0,
          delistedProducts: 0,
          updatedSkus: 0,
          delistedSkus: 0,
          failedProducts: 0,
        },
      }
    }

    // 3. 分页获取1688当前在售商品清单
    const PAGE_SIZE = 20
    let currentPage = 1
    let hasMore = true
    const allOfferItems: { offerId: number }[] = []

    while (hasMore) {
      const listResponse = await querySellerOfferList(
        sellerOpenId,
        currentPage,
        PAGE_SIZE
      )

      if (!listResponse.success || !listResponse.result) {
        return {
          success: false,
          error: listResponse.message || 'Failed to fetch seller offer list',
        }
      }

      const { data, totalPage } = listResponse.result

      for (const item of data) {
        allOfferItems.push({ offerId: item.offerId })
      }

      hasMore = currentPage < totalPage && data.length > 0
      currentPage++
    }

    // 4. 构建1688商品ID集合
    const ali1688OfferIds = new Set(allOfferItems.map(item => String(item.offerId)))

    // 5. 对比处理
    let updatedProducts = 0
    let delistedProducts = 0
    let updatedSkus = 0
    let delistedSkus = 0
    let failedProducts = 0

    // 5a. DB中存在但1688清单中不存在的商品 → 下架
    const delistedProductIds: string[] = []
    for (const product of dbProducts) {
      if (!product.ali1688ProductId || !ali1688OfferIds.has(product.ali1688ProductId)) {
        if (product.status === 'ACTIVE') {
          delistedProductIds.push(product.id)
        }
      }
    }

    if (delistedProductIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: delistedProductIds } },
        data: { status: 'INACTIVE' },
      })
      delistedProducts = delistedProductIds.length
    }

    // 5b. DB中存在且1688中也存在的商品 → 需要更新价格
    const productsToUpdate = dbProducts.filter(
      p => p.ali1688ProductId && ali1688OfferIds.has(p.ali1688ProductId)
    )

    // 使用并发池更新价格（最多5并发）
    const syncResults = await promisePool(
      productsToUpdate,
      async (product) => {
        try {
          const offerId = parseInt(product.ali1688ProductId!, 10)
          const detailResponse = await queryProductDetail(offerId)

          if (!detailResponse.success || !detailResponse.result) {
            console.error(
              `[sync1688] Failed to get detail for offer ${offerId}: ${detailResponse.message}`
            )
            return { success: false, type: 'detail' as const }
          }

          const detail = detailResponse.result
          const skuInfos = detail.productSkuInfos ?? []

          // 构建1688 SKU ID → 价格映射
          const ali1688SkuPriceMap = new Map<string, string>()
          for (const sku of skuInfos) {
            if (sku.skuId != null) {
              ali1688SkuPriceMap.set(String(sku.skuId), sku.price ?? '0')
            }
          }

          // 遍历系统中的SKU，匹配更新
          let productUpdatedSkus = 0
          let productDelistedSkus = 0
          const skuPriceUpdates: { id: string; price: number }[] = []
          const skuDelistIds: string[] = []

          for (const sku of product.skus) {
            if (!sku.ali1688SkuId) continue

            if (ali1688SkuPriceMap.has(sku.ali1688SkuId)) {
              // 1688中存在 → 更新价格
              const cnyPrice = ali1688SkuPriceMap.get(sku.ali1688SkuId)!
              const newPriceSar = convertCnyToSar(cnyPrice, exchangeRate)
              skuPriceUpdates.push({ id: sku.id, price: newPriceSar })
              productUpdatedSkus++
            } else {
              // 1688中不存在 → 标记 OUT_OF_STOCK
              if (sku.stockStatus !== 'OUT_OF_STOCK') {
                skuDelistIds.push(sku.id)
                productDelistedSkus++
              }
            }
          }

          // 批量更新SKU价格
          for (const { id, price } of skuPriceUpdates) {
            await prisma.productSku.update({
              where: { id },
              data: {
                referencePriceSar: price > 0 ? new Decimal(price) : null,
              },
            })
          }

          // 批量更新SKU库存状态
          if (skuDelistIds.length > 0) {
            await prisma.productSku.updateMany({
              where: { id: { in: skuDelistIds } },
              data: { stockStatus: 'OUT_OF_STOCK' },
            })
          }

          // 重新计算Product的 minPriceSar / maxPriceSar
          const allSkus = await prisma.productSku.findMany({
            where: { productId: product.id },
            select: { referencePriceSar: true },
          })

          const validPrices = allSkus
            .map(s => s.referencePriceSar?.toNumber())
            .filter((p): p is number => p != null && p > 0)

          if (validPrices.length > 0) {
            const minPrice = Math.min(...validPrices)
            const maxPrice = Math.max(...validPrices)
            await prisma.product.update({
              where: { id: product.id },
              data: {
                minPriceSar: new Decimal(minPrice),
                maxPriceSar: new Decimal(maxPrice),
              },
            })
          } else {
            await prisma.product.update({
              where: { id: product.id },
              data: {
                minPriceSar: null,
                maxPriceSar: null,
              },
            })
          }

          return {
            success: true,
            updatedSkus: productUpdatedSkus,
            delistedSkus: productDelistedSkus,
          }
        } catch (error) {
          console.error(
            `[sync1688] Failed to sync product ${product.ali1688ProductId}:`,
            error
          )
          return { success: false, type: 'sync' as const }
        }
      },
      5
    )

    // 汇总结果
    for (const result of syncResults) {
      if (result.success) {
        const uSkus = result.updatedSkus ?? 0
        const dSkus = result.delistedSkus ?? 0
        if (uSkus > 0) updatedProducts++
        updatedSkus += uSkus
        delistedSkus += dSkus
      } else {
        failedProducts++
      }
    }

    // 6. 刷新缓存
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/products')

    return {
      success: true,
      stats: {
        totalProducts: dbProducts.length,
        updatedProducts,
        delistedProducts,
        updatedSkus,
        delistedSkus,
        failedProducts,
      },
    }
  } catch (error) {
    console.error('[syncProductsFrom1688] Error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to sync products from 1688',
    }
  }
}
