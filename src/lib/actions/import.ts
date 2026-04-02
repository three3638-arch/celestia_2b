'use server'

import { join } from 'path'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { parseExcel, type ParsedProduct } from '@/lib/excel/parser'
import { batchTranslate, type TranslationResult } from '@/lib/excel/translator'
import { expandSkus, extractGemTypes, extractMetalColors, type ExpandedSku } from '@/lib/excel/sku-expander'
import { processImage } from '@/lib/image'
import { uploadToR2, generateFileKey } from '@/lib/r2'
import type { ApiResponse } from '@/types'
import type { GemType, MetalColor } from '@prisma/client'
import Decimal from 'decimal.js'

// ============================================================
// 类型定义
// ============================================================

interface ProcessedImage {
  url: string
  thumbnailUrl: string
  sortOrder: number
  isPrimary: boolean
}

interface ProcessedSku extends ExpandedSku {
  skuCode: string
}

interface ParsedAndProcessedProduct {
  spuCode: string
  nameZh: string
  nameEn: string
  nameAr: string
  descriptionZh: string
  descriptionEn: string
  descriptionAr: string
  categoryName: string
  categoryId?: string
  gemTypes: GemType[]
  metalColors: MetalColor[]
  referencePriceSarMin: string
  referencePriceSarMax: string
  supplier: string
  supplierLink: string
  skus: ProcessedSku[]
  images: ProcessedImage[]
}

interface ImportTask {
  taskId: string
  status: 'parsing' | 'ready' | 'importing' | 'completed' | 'error'
  filePath: string
  products: ParsedAndProcessedProduct[]
  summary: { spuCount: number; skuCount: number; imageCount: number }
  error?: string
  result?: ImportResult
}

interface ImportPreview {
  spuCode: string
  nameZh: string
  nameEn: string
  nameAr: string
  categoryName: string
  skuCount: number
  primaryImageUrl: string | null
  priceMin: string | null
  priceMax: string | null
  supplier: string | null
  supplierLink: string | null
}

interface ImportResult {
  successCount: number
  failedCount: number
  skippedCount: number
  errors: { spuCode: string; error: string }[]
}

// ============================================================
// 临时任务存储（开发阶段用内存，生产可改 Redis）
// ============================================================

const taskStore = new Map<string, ImportTask>()

const TEMP_DIR = join(process.cwd(), 'public', 'uploads', 'temp')

// ============================================================
// 辅助函数
// ============================================================

/**
 * 生成 SKU 编码
 */
function generateSkuCode(spuCode: string, index: number): string {
  return `${spuCode}-${String(index + 1).padStart(3, '0')}`
}

/**
 * 处理并上传图片
 * @param primaryImage 首图
 * @param extraImages 其他图片
 */
async function processAndUploadImages(
  primaryImage: ArrayBuffer | null,
  extraImages: ArrayBuffer[]
): Promise<ProcessedImage[]> {
  const processedImages: ProcessedImage[] = []
  let sortOrder = 0

  // 处理首图
  if (primaryImage) {
    try {
      const buffer = Buffer.from(new Uint8Array(primaryImage))
      const processed = await processImage(buffer)

      // 上传原图
      const originalKey = generateFileKey('products', 'webp')
      const url = await uploadToR2({
        key: originalKey,
        body: processed.original,
        contentType: 'image/webp',
      })

      // 上传缩略图
      const thumbnailKey = generateFileKey('products/thumbnails', 'webp')
      const thumbnailUrl = await uploadToR2({
        key: thumbnailKey,
        body: processed.thumbnail,
        contentType: 'image/webp',
      })

      processedImages.push({
        url,
        thumbnailUrl,
        sortOrder: sortOrder++,
        isPrimary: true,
      })
    } catch (error) {
      console.error('Failed to process primary image:', error)
    }
  }

  // 处理其他图片
  for (const imageBuffer of extraImages) {
    try {
      const buffer = Buffer.from(new Uint8Array(imageBuffer))
      const processed = await processImage(buffer)

      // 上传原图
      const originalKey = generateFileKey('products', 'webp')
      const url = await uploadToR2({
        key: originalKey,
        body: processed.original,
        contentType: 'image/webp',
      })

      // 上传缩略图
      const thumbnailKey = generateFileKey('products/thumbnails', 'webp')
      const thumbnailUrl = await uploadToR2({
        key: thumbnailKey,
        body: processed.thumbnail,
        contentType: 'image/webp',
      })

      processedImages.push({
        url,
        thumbnailUrl,
        sortOrder: sortOrder++,
        isPrimary: false,
      })
    } catch (error) {
      console.error(`Failed to process extra image ${sortOrder}:`, error)
      // 继续处理其他图片
    }
  }

  return processedImages
}

/**
 * 查找或创建品类
 */
async function findOrCreateCategory(
  categoryName: string,
  translations: TranslationResult
): Promise<string> {
  // 先查找是否存在
  const existing = await prisma.category.findFirst({
    where: {
      OR: [
        { nameZh: categoryName },
        { nameEn: translations.en },
        { nameAr: translations.ar },
      ],
    },
  })

  if (existing) {
    return existing.id
  }

  // 创建新品类
  const newCategory = await prisma.category.create({
    data: {
      nameZh: categoryName,
      nameEn: translations.en,
      nameAr: translations.ar,
      sortOrder: 0,
    },
  })

  return newCategory.id
}

// ============================================================
// Server Actions
// ============================================================

/**
 * 解析 Excel 任务
 */
export async function parseExcelTask(taskId: string): Promise<ApiResponse> {
  try {
    // 1. 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const filePath = join(TEMP_DIR, `${taskId}.xlsx`)
    
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }

    // 初始化任务状态
    const task: ImportTask = {
      taskId,
      status: 'parsing',
      filePath,
      products: [],
      summary: { spuCount: 0, skuCount: 0, imageCount: 0 },
    }
    taskStore.set(taskId, task)

    // 2. 解析 Excel
    const parsedProducts = await parseExcel(filePath)

    if (parsedProducts.length === 0) {
      task.status = 'error'
      task.error = 'No valid products found in Excel file'
      return { success: false, error: 'No valid products found' }
    }

    // 3. 并行处理：翻译 + 图片处理 + SKU 展开
    
    // 准备需要翻译的文本
    // 注意：nameZh 为空时使用 spuCode 作为名称
    const textsToTranslate = parsedProducts.flatMap(p => [
      p.nameZh || p.spuCode,  // 如果名称为空，使用SPU编号
      p.descriptionZh,
      p.categoryName,
    ])

    // 并行执行翻译和图片处理
    const [translations, ...imageResults] = await Promise.all([
      batchTranslate(textsToTranslate),
      ...parsedProducts.map(p => processAndUploadImages(p.primaryImage, p.extraImages)),
    ])

    // 分配翻译结果
    let translationIndex = 0
    const processedProducts: ParsedAndProcessedProduct[] = []

    for (let i = 0; i < parsedProducts.length; i++) {
      const parsed = parsedProducts[i]
      const images = imageResults[i]

      // 获取翻译结果
      const nameTranslation = translations[translationIndex++]
      const descTranslation = translations[translationIndex++]
      const categoryTranslation = translations[translationIndex++]

      // 查找或创建品类
      const categoryId = await findOrCreateCategory(
        parsed.categoryName,
        categoryTranslation
      )

      // 如果名称为空，使用 SPU 编号作为名称
      const displayName = parsed.nameZh || parsed.spuCode

      // 展开 SKU
      const expandedSkus = expandSkus({
        gemTypesRaw: parsed.gemTypesRaw,
        metalColorsRaw: parsed.metalColorsRaw,
        sizesRaw: parsed.sizesRaw,
        chainLengthsRaw: parsed.chainLengthsRaw,
        referencePriceSarMin: parsed.referencePriceSarMin,
        referencePriceSarMax: parsed.referencePriceSarMax,
      })

      // 生成 SKU 编码
      const processedSkus: ProcessedSku[] = expandedSkus.map((sku, index) => ({
        ...sku,
        skuCode: generateSkuCode(parsed.spuCode, index),
      }))

      processedProducts.push({
        spuCode: parsed.spuCode,
        nameZh: displayName,  // 使用处理后的名称（可能来自SPU编号）
        nameEn: nameTranslation.en,
        nameAr: nameTranslation.ar,
        descriptionZh: parsed.descriptionZh,
        descriptionEn: descTranslation.en,
        descriptionAr: descTranslation.ar,
        categoryName: parsed.categoryName,
        categoryId,
        gemTypes: extractGemTypes(parsed.gemTypesRaw),
        metalColors: extractMetalColors(parsed.metalColorsRaw),
        referencePriceSarMin: parsed.referencePriceSarMin,
        referencePriceSarMax: parsed.referencePriceSarMax,
        supplier: parsed.supplier,
        supplierLink: parsed.supplierLink,
        skus: processedSkus,
        images,
      })
    }

    // 更新任务状态
    task.products = processedProducts
    task.summary = {
      spuCount: processedProducts.length,
      skuCount: processedProducts.reduce((sum, p) => sum + p.skus.length, 0),
      imageCount: processedProducts.reduce((sum, p) => sum + p.images.length, 0),
    }
    task.status = 'ready'

    return { success: true }
  } catch (error) {
    console.error('Failed to parse Excel task:', error)
    const task = taskStore.get(taskId)
    
    // 构建用户友好的错误消息
    let errorMessage = '解析Excel文件失败'
    if (error instanceof Error) {
      // 根据错误类型返回具体原因
      if (error.message.includes('Invalid file format') || error.message.includes('not a valid')) {
        errorMessage = '文件格式不正确，请上传有效的Excel文件(.xlsx)'
      } else if (error.message.includes('empty') || error.message.includes('No data')) {
        errorMessage = 'Excel文件为空，请检查文件内容'
      } else if (error.message.includes('required') || error.message.includes('Missing')) {
        errorMessage = 'Excel缺少必需的列，请使用正确的导入模板'
      } else if (error.message.includes('image') || error.message.includes('图片')) {
        errorMessage = '图片处理失败，请检查图片链接是否有效'
      } else {
        errorMessage = `解析失败：${error.message}`
      }
    }
    
    if (task) {
      task.status = 'error'
      task.error = errorMessage
    }
    return { success: false, error: errorMessage }
  }
}

/**
 * 获取导入预览数据
 */
export async function getImportPreview(taskId: string): Promise<ApiResponse<{ preview: ImportPreview[]; summary: ImportTask['summary'] }>> {
  try {
    // 1. 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const task = taskStore.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    if (task.status === 'error') {
      return { success: false, error: task.error || 'Task failed' }
    }

    if (task.status !== 'ready' && task.status !== 'completed') {
      return { success: false, error: 'Task not ready' }
    }

    // 返回前 10 个 SPU 的预览数据
    const preview: ImportPreview[] = task.products.slice(0, 10).map(p => {
      const primaryImage = p.images.find(img => img.isPrimary)
      return {
        spuCode: p.spuCode,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        categoryName: p.categoryName,
        skuCount: p.skus.length,
        primaryImageUrl: primaryImage?.url || null,
        priceMin: p.referencePriceSarMin || null,
        priceMax: p.referencePriceSarMax || null,
        supplier: p.supplier || null,
        supplierLink: p.supplierLink || null,
      }
    })

    return {
      success: true,
      data: {
        preview,
        summary: task.summary,
      },
    }
  } catch (error) {
    console.error('Failed to get import preview:', error)
    return { success: false, error: 'Failed to get preview' }
  }
}

/**
 * 确认导入
 */
export async function confirmImport(taskId: string): Promise<ApiResponse<ImportResult>> {
  try {
    // 1. 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const task = taskStore.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    if (task.status !== 'ready') {
      return { success: false, error: 'Task not ready for import' }
    }

    task.status = 'importing'

    const result: ImportResult = {
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    }

    // 2. 在 Prisma 事务内批量创建
    for (const product of task.products) {
      try {
        await prisma.$transaction(async (tx) => {
          // 检查 SPU 是否已存在
          const existing = await tx.product.findUnique({
            where: { spuCode: product.spuCode },
          })

          if (existing) {
            result.skippedCount++
            result.errors.push({
              spuCode: product.spuCode,
              error: 'SPU code already exists',
            })
            return
          }

          // 直接从产品数据读取价格区间
          const minPrice = product.referencePriceSarMin 
            ? new Decimal(product.referencePriceSarMin) 
            : null
          const maxPrice = product.referencePriceSarMax 
            ? new Decimal(product.referencePriceSarMax) 
            : null

          // 创建商品
          const newProduct = await tx.product.create({
            data: {
              spuCode: product.spuCode,
              nameZh: product.nameZh,
              nameEn: product.nameEn,
              nameAr: product.nameAr,
              descriptionZh: product.descriptionZh,
              descriptionEn: product.descriptionEn,
              descriptionAr: product.descriptionAr,
              categoryId: product.categoryId!,
              gemTypes: product.gemTypes,
              metalColors: product.metalColors,
              minPriceSar: minPrice,
              maxPriceSar: maxPrice,
              supplier: product.supplier || null,
              supplierLink: product.supplierLink || null,
              status: 'ACTIVE',
            },
          })

          // 创建 SKUs
          if (product.skus.length > 0) {
            await tx.productSku.createMany({
              data: product.skus.map(sku => ({
                productId: newProduct.id,
                skuCode: sku.skuCode,
                gemType: sku.gemType,
                metalColor: sku.metalColor,
                size: sku.size,
                chainLength: sku.chainLength,
                // SKU 的参考价使用 min，如果没有则使用 max
                referencePriceSar: sku.referencePriceSarMin 
                  ? new Decimal(sku.referencePriceSarMin) 
                  : sku.referencePriceSarMax 
                    ? new Decimal(sku.referencePriceSarMax) 
                    : null,
                stockStatus: 'IN_STOCK',
              })),
            })
          }

          // 创建图片
          if (product.images.length > 0) {
            await tx.productImage.createMany({
              data: product.images.map((image) => ({
                productId: newProduct.id,
                url: image.url,
                thumbnailUrl: image.thumbnailUrl,
                isPrimary: image.isPrimary,
                sortOrder: image.sortOrder,
              })),
            })
          }

          result.successCount++
        })
      } catch (error) {
        console.error(`Failed to import product ${product.spuCode}:`, error)
        result.failedCount++
        
        // 改善错误消息，避免暴露技术细节
        let errorMessage = '导入失败'
        if (error instanceof Error) {
          // 根据错误类型返回友好的错误消息
          if (error.message.includes('Unique constraint') || error.message.includes('already exists')) {
            errorMessage = 'SPU编码已存在'
          } else if (error.message.includes('Foreign key') || error.message.includes('constraint')) {
            errorMessage = '数据关联错误，请检查品类信息'
          } else if (error.message.includes('required') || error.message.includes('Required')) {
            errorMessage = '缺少必需的数据字段'
          } else if (error.message.includes('format') || error.message.includes('invalid')) {
            errorMessage = '数据格式不正确'
          } else {
            // 对于其他错误，简化消息，不暴露内部细节
            errorMessage = '保存失败，请检查数据是否正确'
          }
        }
        
        result.errors.push({
          spuCode: product.spuCode,
          error: errorMessage,
        })
      }
    }

    // 3. 清理临时文件
    try {
      if (existsSync(task.filePath)) {
        await unlink(task.filePath)
      }
    } catch (error) {
      console.error('Failed to clean up temp file:', error)
    }

    // 更新任务状态
    task.status = 'completed'
    task.result = result

    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to confirm import:', error)
    const task = taskStore.get(taskId)
    
    // 改善错误消息，避免暴露技术细节
    let errorMessage = '导入失败，请稍后重试'
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        errorMessage = '网络连接失败，请检查网络后重试'
      } else if (error.message.includes('timeout')) {
        errorMessage = '导入超时，请减少单次导入数量后重试'
      }
    }
    
    if (task) {
      task.status = 'error'
      task.error = errorMessage
    }
    return { success: false, error: errorMessage }
  }
}

/**
 * 获取任务状态
 */
export async function getImportTaskStatus(taskId: string): Promise<ApiResponse<{ status: ImportTask['status']; error?: string; result?: ImportResult }>> {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized' }
    }

    const task = taskStore.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    return {
      success: true,
      data: {
        status: task.status,
        error: task.error,
        result: task.result,
      },
    }
  } catch (error) {
    console.error('Failed to get task status:', error)
    return { success: false, error: 'Failed to get task status' }
  }
}
