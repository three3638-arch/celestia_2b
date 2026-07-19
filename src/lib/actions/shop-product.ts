'use server'

import { prisma } from '@/lib/db'
import { requireShopUser, requireShopAdmin } from '@/lib/shop-auth'
import { aggregateProductPriceRange, resolveShopPrice } from '@/lib/shop-price'
import { deleteR2ObjectByUrl } from '@/lib/r2'
import { shopProductSchema, shopVariantPricingSchema } from '@/lib/validations/shop'
import type { ApiResponse } from '@/types'
import type { ShopProductStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

export type ShopCatalogSort = 'newest' | 'price_asc' | 'price_desc'

function buildOnSaleWhere(now: Date): Prisma.ShopProductWhereInput {
  return {
    variants: {
      some: {
        stockStatus: { not: 'OUT_OF_STOCK' },
        salePrice: { not: null },
        saleStartAt: { lte: now },
        saleEndAt: { gt: now },
      },
    },
  }
}

function pickLocalized<T extends { titleZh: string; titleEn: string; titleAr: string }>(
  item: T,
  locale: string
): string {
  if (locale === 'zh') return item.titleZh
  if (locale === 'ar') return item.titleAr
  return item.titleEn
}

export async function getShopCatalogProducts(params: {
  locale?: string
  categoryId?: string
  sortBy?: ShopCatalogSort
  onSaleOnly?: boolean
  page?: number
  pageSize?: number
}) {
  const locale = params.locale || 'en'
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 24))
  const sortBy = params.sortBy || 'newest'
  const now = new Date()

  const where: Prisma.ShopProductWhereInput = {
    status: 'ACTIVE',
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.onSaleOnly ? buildOnSaleWhere(now) : {}),
  }

  const mapProduct = (
    p: Awaited<ReturnType<typeof prisma.shopProduct.findMany>>[number] & {
      images: { thumbnailUrl: string | null; url: string }[]
      variants: Parameters<typeof aggregateProductPriceRange>[0]
      category: { nameZh: string; nameEn: string; nameAr: string }
    }
  ) => {
    const range = aggregateProductPriceRange(p.variants)
    const primaryImage = p.images[0]
    return {
      id: p.id,
      slug: p.slug,
      title: pickLocalized(p, locale),
      categoryName:
        locale === 'zh' ? p.category.nameZh : locale === 'ar' ? p.category.nameAr : p.category.nameEn,
      imageUrl: primaryImage?.thumbnailUrl || primaryImage?.url || null,
      minPrice: range.minPrice,
      maxPrice: range.maxPrice,
      hasOnSale: range.hasOnSale,
      createdAt: p.createdAt,
    }
  }

  const include = {
    images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
    variants: true,
    category: true,
  }

  if (sortBy === 'price_asc' || sortBy === 'price_desc') {
    const products = await prisma.shopProduct.findMany({ where, include, orderBy: { sortOrder: 'asc' } })
    const items = products.map(mapProduct)
    if (sortBy === 'price_asc') items.sort((a, b) => parseFloat(a.minPrice) - parseFloat(b.minPrice))
    else items.sort((a, b) => parseFloat(b.minPrice) - parseFloat(a.minPrice))
    const total = items.length
    const start = (page - 1) * pageSize
    const paged = items.slice(start, start + pageSize)
    return { items: paged, page, pageSize, total, hasMore: start + pageSize < total }
  }

  const total = await prisma.shopProduct.count({ where })
  const products = await prisma.shopProduct.findMany({
    where,
    include,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  const items = products.map(mapProduct)

  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  }
}

export async function getShopProductBySlug(slug: string, locale = 'en') {
  const product = await prisma.shopProduct.findFirst({
    where: { slug, status: 'ACTIVE' },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      variants: { orderBy: { sortOrder: 'asc' } },
      category: true,
    },
  })

  if (!product) return null

  const variants = product.variants.map((v) => {
    const price = resolveShopPrice(v)
    const name =
      locale === 'zh' ? v.nameZh || v.variantCode : locale === 'ar' ? v.nameAr || v.variantCode : v.nameEn || v.variantCode
    return {
      id: v.id,
      variantCode: v.variantCode,
      name,
      stockStatus: v.stockStatus,
      currency: v.currency,
      ...price,
    }
  })

  return {
    id: product.id,
    slug: product.slug,
    title: pickLocalized(product, locale),
    description:
      locale === 'zh'
        ? product.descriptionZh
        : locale === 'ar'
          ? product.descriptionAr
          : product.descriptionEn,
    images: product.images,
    variants,
    category: product.category,
  }
}

export async function getShopInquiryContext(
  productId: string,
  variantId: string | undefined,
  locale = 'en'
) {
  const product = await prisma.shopProduct.findFirst({
    where: { id: productId, status: 'ACTIVE' },
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      variants: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!product) return null

  let variant = product.variants[0]
  if (variantId) {
    variant = product.variants.find((v) => v.id === variantId) || variant
  }
  if (!variant) return null

  const price = resolveShopPrice(variant)
  const variantName =
    locale === 'zh'
      ? variant.nameZh || variant.variantCode
      : locale === 'ar'
        ? variant.nameAr || variant.variantCode
        : variant.nameEn || variant.variantCode

  return {
    productId: product.id,
    title: pickLocalized(product, locale),
    imageUrl: product.images[0]?.thumbnailUrl || product.images[0]?.url || null,
    variantId: variant.id,
    variantName,
    ...price,
    currency: variant.currency,
  }
}

export async function getAdminShopProducts() {
  await requireShopUser()
  return prisma.shopProduct.findMany({
    include: {
      category: true,
      variants: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getAdminShopProduct(id: string) {
  await requireShopUser()
  return prisma.shopProduct.findUnique({
    where: { id },
    include: {
      category: true,
      variants: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function createShopProduct(data: unknown, variants: unknown[]): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const parsed = shopProductSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
    }

    const variantList = []
    for (const v of variants) {
      const vp = shopVariantPricingSchema.safeParse(v)
      if (!vp.success) {
        return { success: false, error: vp.error.issues.map((i) => i.message).join('；') }
      }
      variantList.push(vp.data)
    }

    if (variantList.length === 0) {
      return { success: false, error: '至少需要一个 SKU 变体' }
    }

    const product = await prisma.shopProduct.create({
      data: {
        ...parsed.data,
        variants: {
          create: variantList.map((v) => ({
            variantCode: v.variantCode,
            nameZh: v.nameZh,
            nameEn: v.nameEn,
            nameAr: v.nameAr,
            stockStatus: v.stockStatus || 'IN_STOCK',
            listPrice: new Prisma.Decimal(v.listPrice),
            salePrice: v.salePrice != null ? new Prisma.Decimal(v.salePrice) : null,
            saleStartAt: v.saleStartAt ? new Date(v.saleStartAt) : null,
            saleEndAt: v.saleEndAt ? new Date(v.saleEndAt) : null,
            currency: v.currency || 'SAR',
            sortOrder: v.sortOrder ?? 0,
          })),
        },
      },
    })

    return { success: true, data: { id: product.id }, message: '商品创建成功' }
  } catch (e) {
    console.error(e)
    return { success: false, error: '创建失败，请检查 slug/variantCode 是否重复' }
  }
}

export async function updateShopProduct(
  id: string,
  data: unknown,
  variants?: unknown[]
): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const parsed = shopProductSchema.partial().safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
    }

    await prisma.$transaction(async (tx) => {
      await tx.shopProduct.update({ where: { id }, data: parsed.data })

      if (!variants) return

      const existing = await tx.shopProductVariant.findMany({ where: { productId: id } })
      const existingById = new Map(existing.map((v) => [v.id, v]))
      const keptIds = new Set<string>()

      for (const raw of variants) {
        const vp = shopVariantPricingSchema.safeParse(raw)
        if (!vp.success) throw new Error(vp.error.issues.map((i) => i.message).join('；'))

        const variantData = {
          variantCode: vp.data.variantCode,
          nameZh: vp.data.nameZh,
          nameEn: vp.data.nameEn,
          nameAr: vp.data.nameAr,
          stockStatus: vp.data.stockStatus || ('IN_STOCK' as const),
          listPrice: new Prisma.Decimal(vp.data.listPrice),
          salePrice: vp.data.salePrice != null ? new Prisma.Decimal(vp.data.salePrice) : null,
          saleStartAt: vp.data.saleStartAt ? new Date(vp.data.saleStartAt) : null,
          saleEndAt: vp.data.saleEndAt ? new Date(vp.data.saleEndAt) : null,
          currency: vp.data.currency || 'SAR',
          sortOrder: vp.data.sortOrder ?? 0,
        }

        if (vp.data.id && existingById.has(vp.data.id)) {
          await tx.shopProductVariant.update({
            where: { id: vp.data.id },
            data: variantData,
          })
          keptIds.add(vp.data.id)
        } else {
          const created = await tx.shopProductVariant.create({
            data: { productId: id, ...variantData },
          })
          keptIds.add(created.id)
        }
      }

      const removedIds = existing.filter((v) => !keptIds.has(v.id)).map((v) => v.id)
      for (const variantId of removedIds) {
        const [cartRefs, orderRefs, inquiryRefs] = await Promise.all([
          tx.shopCartItem.count({ where: { variantId } }),
          tx.shopOrderItem.count({ where: { variantId } }),
          tx.shopInquiry.count({ where: { variantId } }),
        ])
        if (cartRefs === 0 && orderRefs === 0 && inquiryRefs === 0) {
          await tx.shopProductVariant.delete({ where: { id: variantId } })
        } else {
          await tx.shopProductVariant.update({
            where: { id: variantId },
            data: { stockStatus: 'OUT_OF_STOCK' },
          })
        }
      }
    })

    return { success: true, message: '商品更新成功' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '更新失败' }
  }
}

export async function updateShopProductStatus(id: string, status: ShopProductStatus): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    await prisma.shopProduct.update({ where: { id }, data: { status } })
    return { success: true, message: '状态已更新' }
  } catch {
    return { success: false, error: '更新失败' }
  }
}

export async function deleteShopProduct(id: string): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    const inquiryCount = await prisma.shopInquiry.count({ where: { productId: id } })
    if (inquiryCount > 0) {
      return { success: false, error: '该商品存在询价记录，无法删除，请改为下架' }
    }

    const product = await prisma.shopProduct.findUnique({
      where: { id },
      include: { images: true },
    })
    if (!product) {
      return { success: false, error: '商品不存在' }
    }

    await Promise.all(
      product.images.flatMap((img) => [
        deleteR2ObjectByUrl(img.url),
        deleteR2ObjectByUrl(img.thumbnailUrl),
      ])
    )

    await prisma.shopProduct.delete({ where: { id } })
    return { success: true, message: '商品已删除' }
  } catch {
    return { success: false, error: '删除失败' }
  }
}

export async function addShopProductImage(
  productId: string,
  url: string,
  thumbnailUrl?: string
): Promise<ApiResponse> {
  try {
    await requireShopUser()
    const count = await prisma.shopProductImage.count({ where: { productId } })
    const image = await prisma.shopProductImage.create({
      data: {
        productId,
        url,
        thumbnailUrl,
        isPrimary: count === 0,
        sortOrder: count,
      },
    })
    return {
      success: true,
      message: '图片已添加',
      data: { id: image.id, url: image.url, thumbnailUrl: image.thumbnailUrl },
    }
  } catch {
    return { success: false, error: '添加图片失败' }
  }
}

export async function deleteShopProductImage(imageId: string): Promise<ApiResponse> {
  try {
    await requireShopUser()
    const image = await prisma.shopProductImage.findUnique({ where: { id: imageId } })
    if (!image) {
      return { success: false, error: '图片不存在' }
    }

    await Promise.all([
      deleteR2ObjectByUrl(image.url),
      deleteR2ObjectByUrl(image.thumbnailUrl),
    ])

    await prisma.shopProductImage.delete({ where: { id: imageId } })
    return { success: true }
  } catch {
    return { success: false, error: '删除失败' }
  }
}
