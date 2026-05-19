import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db'
import Decimal from 'decimal.js'
import path from 'path'
import fs from 'fs'

interface OrderItemWithRelations {
  id: string
  skuId: string
  productNameSnapshot: string
  skuDescSnapshot: string
  quantity: number
  unitPriceCny: Decimal | null
  unitPriceSar: Decimal | null
  itemStatus: string
  settlementQty: number | null
  settlementPriceCny: Decimal | null
  sku: {
    productId: string
    product: {
      id: string
      spuCode: string
      images: Array<{ url: string; thumbnailUrl: string | null }>
    }
  }
}

interface OrderForExport {
  id: string
  orderNo: string
  userId: string
  exchangeRate: Decimal | null
  items: OrderItemWithRelations[]
}

/**
 * 下载图片并返回 Buffer。支持本地相对路径和外部URL。
 * 失败时返回 null，不会抛出异常。
 */
async function downloadImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    if (imageUrl.startsWith('/uploads/')) {
      // 本地文件：基于项目 public 目录解析
      const filePath = path.join(process.cwd(), 'public', imageUrl)
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath)
      }
      return null
    }

    // 外部 URL：fetch 下载
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

/**
 * 根据文件路径/URL 推断图片格式
 */
function getImageExtension(url: string): 'jpeg' | 'png' {
  const lower = url.toLowerCase()
  if (lower.includes('.png')) return 'png'
  // 默认 jpeg（webp、jpg 等统一按 jpeg 处理，Excel 兼容性更好）
  return 'jpeg'
}

/**
 * 生成订单明细 Excel（客户视角）
 */
export async function generateOrderDetailExcel(order: OrderForExport): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(`订单明细-${order.orderNo}`)

  // 第1行：标题
  worksheet.mergeCells('A1:F1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = '订单明细'
  titleCell.font = { bold: true, size: 16 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  // 第2行：订单号
  worksheet.mergeCells('A2:F2')
  const orderNoCell = worksheet.getCell('A2')
  orderNoCell.value = `订单号：${order.orderNo}`
  orderNoCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 22

  // 第3行：空行

  // 第4行：表头
  const headers = ['商品ID', 'SKU ID', '图片', '数量', '客户单价(SAR)', '合计(SAR)']
  const headerRow = worksheet.getRow(4)
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { bold: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  headerRow.height = 22

  // 设置列宽
  worksheet.getColumn(1).width = 20   // 商品ID
  worksheet.getColumn(2).width = 20   // SKU ID
  worksheet.getColumn(3).width = 15   // 图片
  worksheet.getColumn(4).width = 10   // 数量
  worksheet.getColumn(5).width = 16   // 客户单价(SAR)
  worksheet.getColumn(6).width = 16   // 合计(SAR)

  // 过滤订单项：排除 CUSTOMER_REMOVED 和 OUT_OF_STOCK
  const filteredItems = order.items.filter(
    (item) => item.itemStatus !== 'CUSTOMER_REMOVED' && item.itemStatus !== 'OUT_OF_STOCK'
  )

  // 数据行
  let totalQty = 0
  let totalAmount = 0
  const imageIds: number[] = []

  // 先收集所有需要下载的图片
  const imageDataMap = new Map<number, Buffer | null>()

  for (let i = 0; i < filteredItems.length; i++) {
    const item = filteredItems[i]
    const imageUrl = item.sku.product.images[0]?.url || null

    if (imageUrl) {
      const imageBuffer = await downloadImageBuffer(imageUrl)
      imageDataMap.set(i, imageBuffer)

      if (imageBuffer) {
        const ext = getImageExtension(imageUrl)
        const imageId = workbook.addImage({
          buffer: imageBuffer as any,
          extension: ext,
        })
        imageIds.push(imageId)
      }
    } else {
      imageDataMap.set(i, null)
    }
  }

  let imageIndex = 0

  for (let i = 0; i < filteredItems.length; i++) {
    const item = filteredItems[i]
    const rowNumber = 5 + i
    const row = worksheet.getRow(rowNumber)

    // 数量逻辑：优先 settlementQty
    const qty = item.settlementQty !== null && item.settlementQty !== undefined
      ? item.settlementQty
      : item.quantity

    // 价格逻辑：优先 settlementPriceSar（由 settlementPriceCny * exchangeRate 计算）
    let unitPriceSar = 0
    if (item.settlementPriceCny && order.exchangeRate) {
      unitPriceSar = new Decimal(item.settlementPriceCny.toString())
        .mul(order.exchangeRate.toString())
        .toDecimalPlaces(2)
        .toNumber()
    } else if (item.unitPriceSar) {
      unitPriceSar = parseFloat(item.unitPriceSar.toString())
    }

    const subtotal = unitPriceSar * qty
    totalQty += qty
    totalAmount += subtotal

    row.getCell(1).value = item.sku.product.id
    row.getCell(2).value = item.skuId
    row.getCell(3).value = '' // 图片列占位，后续插入图片
    row.getCell(4).value = qty
    row.getCell(5).value = unitPriceSar
    row.getCell(6).value = subtotal

    // 格式化数字列
    row.getCell(5).numFmt = '#,##0.00'
    row.getCell(6).numFmt = '#,##0.00'

    // 居中对齐
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }

    // 插入图片
    const imageBuffer = imageDataMap.get(i)
    if (imageBuffer && imageIndex < imageIds.length) {
      const currentImageId = imageIds[imageIndex]
      imageIndex++

      // 设置行高以容纳图片（约 60px = 45 points）
      row.height = 45

      worksheet.addImage(currentImageId, {
        tl: { col: 2, row: rowNumber - 1 },
        ext: { width: 40, height: 40 },
      })
    }
  }

  // 合计行
  const totalRowIndex = 5 + filteredItems.length
  const totalRow = worksheet.getRow(totalRowIndex)
  totalRow.getCell(3).value = '合计'
  totalRow.getCell(3).font = { bold: true }
  totalRow.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
  totalRow.getCell(4).value = totalQty
  totalRow.getCell(4).font = { bold: true }
  totalRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
  totalRow.getCell(6).value = totalAmount
  totalRow.getCell(6).font = { bold: true }
  totalRow.getCell(6).numFmt = '#,##0.00'

  // 生成 buffer
  const excelBuffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(excelBuffer)
}

/**
 * 查询订单数据（用于导出）
 */
export async function getOrderForExport(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          sku: {
            include: {
              product: {
                include: {
                  images: {
                    take: 1,
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}
