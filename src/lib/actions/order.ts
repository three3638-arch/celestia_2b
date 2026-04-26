'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generateOrderNo } from '@/lib/utils'
import { calculateCustomerPrice, decimalAdd, decimalMul } from '@/lib/decimal'
import { createOrderSchema, customerUpdateOrderSchema, submitQuoteSchema, adjustOrderSchema, updateOrderStatusSchema } from '@/lib/validations/order'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import { DEFAULT_EXCHANGE_RATE, ORDER_STATUS_CONFIG } from '@/lib/constants'
import type { ApiResponse, PaginatedResponse, OrderFilterParams } from '@/types'
import { revalidatePath } from 'next/cache'
import Decimal from 'decimal.js'
import { Prisma } from '@prisma/client'
// ============================================================
// 字段名映射
// ============================================================

/** createOrder 字段名映射 */
const createOrderFieldNameMap: Record<string, string> = {
  items: '商品项',
  'items.skuId': 'SKU ID',
  'items.quantity': '数量',
}

/** customerUpdateOrder 字段名映射 */
const customerUpdateOrderFieldNameMap: Record<string, string> = {
  removeItemIds: '要删除的商品项',
  updateItems: '要更新的商品项',
  addItems: '要添加的商品项',
  'updateItems.orderItemId': '订单项ID',
  'updateItems.quantity': '数量',
  'addItems.skuId': 'SKU ID',
  'addItems.quantity': '数量',
}

/** submitQuote 字段名映射 */
const submitQuoteFieldNameMap: Record<string, string> = {
  orderId: '订单ID',
  exchangeRate: '汇率',
  markupRatio: '加价比例',
  items: '报价项',
  'items.orderItemId': '订单项ID',
  'items.unitPriceCny': '人民币单价',
  overrideTotalSar: '覆盖总价',
}

/** adjustOrder 字段名映射 */
const adjustOrderFieldNameMap: Record<string, string> = {
  items: '调整项',
  'items.orderItemId': '订单项ID',
  'items.quantity': '数量',
  'items.unitPriceCny': '人民币单价',
}

/** updateOrderStatus 字段名映射 */
const updateOrderStatusFieldNameMap: Record<string, string> = {
  status: '订单状态',
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

/**
 * 验证用户是否为 ADMIN
 */
async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }
  return user
}

/**
 * SKU 参考价（SAR，无加价）→ 成本单价 CNY：除以汇率后，小数点后 1 位向上取整（与报价页约定一致）
 */
function referenceSarToCostCnyCeil1(refSar: Decimal, exchangeRate: number): string | null {
  if (exchangeRate <= 0 || refSar.lte(0)) return null
  const raw = refSar.div(exchangeRate)
  const out = raw.mul(10).ceil().div(10)
  return out.toDecimalPlaces(1).toString()
}

/**
 * 报价页：对 unit_price_cny 为空的行生成建议成本 CNY
 * - 优先级 2：其他订单中该 SKU 最近一次保存的报价 CNY（按 orders.updated_at 最新）
 * - 优先级 3：SKU.reference_price_sar 按汇率换算为 CNY
 */
async function getSuggestedCostCnyByOrderItemId(params: {
  orderId: string
  rateForReference: number
  lineItems: Array<{ id: string; skuId: string; unitPriceCny: Decimal | null }>
}): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const needs = params.lineItems.filter((i) => i.unitPriceCny == null)
  if (needs.length === 0) return out

  const skuIds = [...new Set(needs.map((i) => i.skuId))]
  if (skuIds.length === 0) return out

  const p2Rows = await prisma.$queryRaw<Array<{ sku_id: string; unit_price_cny: unknown }>>`
    WITH ranked AS (
      SELECT
        oi.sku_id AS sku_id,
        oi.unit_price_cny AS unit_price_cny,
        ROW_NUMBER() OVER (
          PARTITION BY oi.sku_id
          ORDER BY o.updated_at DESC
        ) AS rn
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE oi.order_id <> ${params.orderId}
        AND oi.unit_price_cny IS NOT NULL
        AND oi.sku_id IN (${Prisma.join(skuIds)})
    )
    SELECT sku_id, unit_price_cny FROM ranked WHERE rn = 1
  `

  const p2BySku = new Map<string, string>()
  for (const row of p2Rows) {
    if (row.unit_price_cny == null) continue
    p2BySku.set(
      row.sku_id,
      new Decimal(String(row.unit_price_cny)).toDecimalPlaces(2).toString()
    )
  }

  const needP3 = skuIds.filter((id) => !p2BySku.has(id))
  const p3BySku = new Map<string, string>()
  if (needP3.length > 0) {
    const skus = await prisma.productSku.findMany({
      where: { id: { in: needP3 } },
      select: { id: true, referencePriceSar: true },
    })
    for (const sku of skus) {
      if (!sku.referencePriceSar) continue
      const cny = referenceSarToCostCnyCeil1(
        new Decimal(sku.referencePriceSar.toString()),
        params.rateForReference
      )
      if (cny) p3BySku.set(sku.id, cny)
    }
  }

  for (const line of needs) {
    const fromP2 = p2BySku.get(line.skuId)
    if (fromP2) {
      out.set(line.id, fromP2)
      continue
    }
    const fromP3 = p3BySku.get(line.skuId)
    if (fromP3) out.set(line.id, fromP3)
  }

  return out
}

/**
 * 获取订单首个商品图片
 */
async function getOrderFirstImage(orderId: string): Promise<string | null> {
  const orderItem = await prisma.orderItem.findFirst({
    where: { orderId },
    include: {
      sku: {
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })
  
  return orderItem?.sku.product.images[0]?.url || null
}

/**
 * 验证状态流转是否合法
 */
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const transitions: Record<string, string[]> = {
    PENDING_QUOTE: ['QUOTED', 'NEGOTIATING', 'CANCELLED'],
    QUOTED: ['NEGOTIATING', 'CONFIRMED', 'CANCELLED'],
    NEGOTIATING: ['QUOTED', 'CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PARTIALLY_PAID', 'FULLY_PAID', 'CANCELLED'],
    PARTIALLY_PAID: ['FULLY_PAID', 'CANCELLED'],
    FULLY_PAID: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['SETTLING', 'CANCELLED'],
    SETTLING: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  }
  
  return transitions[currentStatus]?.includes(newStatus) || false
}

// ============================================================
// 客户端操作
// ============================================================

/**
 * 创建订单
 */
export async function createOrder(
  data: unknown
): Promise<ApiResponse<{ orderId: string; orderNo: string }>> {
  try {
    const user = await requireActiveUser()
    
    // 验证输入数据
    const validation = createOrderSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, createOrderFieldNameMap) }
    }
    
    const validated = validation.data
    
    const orderNo = generateOrderNo()
    
    // 查询所有 SKU 和对应商品信息
    const skuIds = validated.items.map(item => item.skuId)
    const skus = await prisma.productSku.findMany({
      where: { id: { in: skuIds } },
      include: {
        product: {
          select: {
            nameEn: true,
            nameZh: true,
          },
        },
      },
    })
    
    const skuMap = new Map(skus.map(s => [s.id, s]))
    
    // 验证所有 SKU 存在
    for (const item of validated.items) {
      if (!skuMap.has(item.skuId)) {
        return { success: false, error: `SKU not found: ${item.skuId}` }
      }
    }
    
    // 事务创建订单
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          userId: user.id,
          status: 'PENDING_QUOTE',
        },
      })
      
      // 创建订单项
      for (const item of validated.items) {
        const sku = skuMap.get(item.skuId)!
        const productName = sku.product.nameEn || sku.product.nameZh || 'Product'
        const skuDesc = `${sku.gemType} / ${sku.metalColor}${sku.mainStoneSize ? ` / ${sku.mainStoneSize}mm` : ''}${sku.size ? ` / Size ${sku.size}` : ''}${sku.chainLength ? ` / ${sku.chainLength}` : ''}`
        
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            skuId: item.skuId,
            productNameSnapshot: productName,
            skuDescSnapshot: skuDesc,
            quantity: item.quantity,
            itemStatus: 'PENDING_QUOTE',
          },
        })
      }
      
      return newOrder
    })
    
    revalidatePath('/[locale]/storefront/orders')
    
    return {
      success: true,
      data: { orderId: order.id, orderNo: order.orderNo },
    }
  } catch (error) {
    console.error('Create order error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, error: 'Please login first' }
    }
    if (error instanceof Error && error.message === 'Account not activated') {
      return { success: false, error: 'Account pending approval' }
    }
    return { success: false, error: 'Failed to create order' }
  }
}

/**
 * 获取我的订单列表
 */
export async function getMyOrders(
  params: OrderFilterParams = {}
): Promise<ApiResponse<PaginatedResponse<{
  id: string
  orderNo: string
  status: string
  statusLabel: string
  itemCount: number
  totalSar: string | null
  firstImage: string | null
  createdAt: Date
}>>> {
  try {
    const user = await requireActiveUser()
    
    const page = params.page || 1
    const pageSize = Math.min(params.pageSize || 20, 100)
    const skip = (page - 1) * pageSize
    
    const where: Record<string, unknown> = { userId: user.id }
    if (params.status) {
      where.status = params.status
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ])
    
    // 获取每个订单的首个商品图片
    const ordersWithImages = await Promise.all(
      orders.map(async (order) => {
        const firstImage = await getOrderFirstImage(order.id)
        const statusKey = order.status as keyof typeof ORDER_STATUS_CONFIG
        return {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          statusLabel: ORDER_STATUS_CONFIG[statusKey]?.label_en || order.status,
          itemCount: order._count.items,
          totalSar: order.totalSar?.toString() || null,
          firstImage,
          createdAt: order.createdAt,
        }
      })
    )
    
    return {
      success: true,
      data: {
        items: ordersWithImages,
        total,
        hasMore: skip + orders.length < total,
      },
    }
  } catch (error) {
    console.error('Get my orders error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, error: 'Please login first' }
    }
    return { success: false, error: 'Failed to fetch orders' }
  }
}

/**
 * 获取订单详情
 */
export async function getOrderDetail(
  orderId: string
): Promise<ApiResponse<{
  id: string
  orderNo: string
  status: string
  statusLabel: string
  exchangeRate: string | null
  markupRatio: string | null
  totalCny: string | null
  totalSar: string | null
  overrideTotalSar: string | null
  shippingCostCny: string | null
  createdAt: Date
  confirmedAt: Date | null
  items: Array<{
    id: string
    skuId: string
    productNameSnapshot: string
    skuDescSnapshot: string
    quantity: number
    unitPriceCny: string | null
    unitPriceSar: string | null
    itemStatus: string
    productImage: string | null
  }>
  payments: Array<{
    id: string
    amountSar: string
    method: string
    proofUrl: string | null
    note: string | null
    confirmedAt: Date
  }>
  shipping: {
    id: string
    trackingNo: string | null
    trackingUrl: string | null
    method: string | null
    note: string | null
  } | null
}>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Please login first' }
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        shipping: true,
      },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 验证权限（客户只能看自己的订单）
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    const statusKey = order.status as keyof typeof ORDER_STATUS_CONFIG
    
    return {
      success: true,
      data: {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        statusLabel: ORDER_STATUS_CONFIG[statusKey]?.label_en || order.status,
        exchangeRate: order.exchangeRate?.toString() || null,
        markupRatio: order.markupRatio?.toString() || null,
        totalCny: order.totalCny?.toString() || null,
        totalSar: order.totalSar?.toString() || null,
        overrideTotalSar: order.overrideTotalSar?.toString() || null,
        shippingCostCny: order.shippingCostCny?.toString() || null,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        items: order.items.map(item => ({
          id: item.id,
          skuId: item.skuId,
          productNameSnapshot: item.productNameSnapshot,
          skuDescSnapshot: item.skuDescSnapshot,
          quantity: item.quantity,
          unitPriceCny: item.unitPriceCny?.toString() || null,
          unitPriceSar: item.unitPriceSar?.toString() || null,
          itemStatus: item.itemStatus,
          productImage: item.sku.product.images[0]?.url || null,
        })),
        payments: order.payments.map(p => ({
          id: p.id,
          amountSar: p.amountSar.toString(),
          method: p.method,
          proofUrl: p.proofUrl,
          note: p.note,
          confirmedAt: p.confirmedAt,
        })),
        shipping: order.shipping ? {
          id: order.shipping.id,
          trackingNo: order.shipping.trackingNo,
          trackingUrl: order.shipping.trackingUrl,
          method: order.shipping.method,
          note: order.shipping.note,
        } : null,
      },
    }
  } catch (error) {
    console.error('Get order detail error:', error)
    return { success: false, error: 'Failed to fetch order detail' }
  }
}

/**
 * 客户更新订单
 */
export async function customerUpdateOrder(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    const user = await requireActiveUser()
    
    // 验证输入数据
    const validation = customerUpdateOrderSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, customerUpdateOrderFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    if (order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    // 仅允许特定状态
    const allowedStatuses = ['PENDING_QUOTE', 'QUOTED', 'NEGOTIATING']
    if (!allowedStatuses.includes(order.status)) {
      return { success: false, error: 'Order cannot be modified at current status' }
    }
    
    // 查询新增 SKU 信息
    const addSkuIds = validated.addItems?.map(item => item.skuId) || []
    const skus = addSkuIds.length > 0
      ? await prisma.productSku.findMany({
          where: { id: { in: addSkuIds } },
          include: {
            product: {
              select: { nameEn: true, nameZh: true },
            },
          },
        })
      : []
    const skuMap = new Map(skus.map(s => [s.id, s]))
    
    await prisma.$transaction(async (tx) => {
      // 1. 删除商品项
      if (validated.removeItemIds && validated.removeItemIds.length > 0) {
        await tx.orderItem.updateMany({
          where: {
            id: { in: validated.removeItemIds },
            orderId,
          },
          data: { itemStatus: 'CUSTOMER_REMOVED' },
        })
      }
      
      // 2. 更新商品项
      if (validated.updateItems) {
        for (const update of validated.updateItems) {
          const updateData: Record<string, unknown> = {}
          if (update.quantity !== undefined) {
            updateData.quantity = update.quantity
          }
          if (update.note !== undefined) {
            // note 字段在 OrderItem 中不存在，跳过
          }
          
          if (Object.keys(updateData).length > 0) {
            await tx.orderItem.update({
              where: { id: update.orderItemId },
              data: updateData,
            })
          }
        }
      }
      
      // 3. 追加商品项
      if (validated.addItems) {
        for (const item of validated.addItems) {
          const sku = skuMap.get(item.skuId)
          if (!sku) continue
          
          const productName = sku.product.nameEn || sku.product.nameZh || 'Product'
          const skuDesc = `${sku.gemType} / ${sku.metalColor}${sku.mainStoneSize ? ` / ${sku.mainStoneSize}mm` : ''}${sku.size ? ` / Size ${sku.size}` : ''}${sku.chainLength ? ` / ${sku.chainLength}` : ''}`
          
          await tx.orderItem.create({
            data: {
              orderId,
              skuId: item.skuId,
              productNameSnapshot: productName,
              skuDescSnapshot: skuDesc,
              quantity: item.quantity,
              itemStatus: 'PENDING_QUOTE',
            },
          })
        }
      }
      
      // 4. 更新订单状态（如果已报价，变为协商中）
      if (order.status === 'QUOTED') {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'NEGOTIATING' },
        })
      }

      // 5. 重新计算订单金额（仅当订单已有报价时才需要）
      if (order.status === 'QUOTED' || order.status === 'NEGOTIATING') {
        const updatedItems = await tx.orderItem.findMany({
          where: { orderId },
        })

        let newTotalCny = new Decimal(0)
        let newTotalSar = new Decimal(0)

        for (const item of updatedItems) {
          if (item.itemStatus === 'CUSTOMER_REMOVED') continue
          if (item.unitPriceCny && item.unitPriceSar) {
            newTotalCny = newTotalCny.add(new Decimal(item.unitPriceCny).mul(item.quantity))
            newTotalSar = newTotalSar.add(new Decimal(item.unitPriceSar).mul(item.quantity))
          }
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            totalCny: newTotalCny.toDecimalPlaces(2),
            totalSar: newTotalSar.toDecimalPlaces(2),
          },
        })
      }
    })
    
    revalidatePath(`/[locale]/storefront/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Customer update order error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, error: 'Please login first' }
    }
    return { success: false, error: 'Failed to update order' }
  }
}

/**
 * 客户确认订单
 */
export async function confirmOrder(
  orderId: string
): Promise<ApiResponse<void>> {
  try {
    const user = await requireActiveUser()
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    if (order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    if (order.status !== 'QUOTED') {
      return { success: false, error: 'Order must be quoted before confirmation' }
    }
    
    await prisma.$transaction(async (tx) => {
      // 更新订单状态
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      })
      
      // 更新所有 QUOTED 的 items 为 CONFIRMED
      await tx.orderItem.updateMany({
        where: {
          orderId,
          itemStatus: 'QUOTED',
        },
        data: { itemStatus: 'CONFIRMED' },
      })
    })
    
    revalidatePath(`/[locale]/storefront/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Confirm order error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, error: 'Please login first' }
    }
    return { success: false, error: 'Failed to confirm order' }
  }
}

/**
 * 客户取消订单
 */
export async function cancelOrder(
  orderId: string
): Promise<ApiResponse<void>> {
  try {
    const user = await requireActiveUser()
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    if (order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    // 检查是否有付款记录
    if (order.payments.length > 0) {
      return { success: false, error: 'Cannot cancel order with payments' }
    }
    
    // 检查状态是否允许取消
    const cancellableStatuses = ['PENDING_QUOTE', 'QUOTED', 'NEGOTIATING']
    if (!cancellableStatuses.includes(order.status)) {
      return { success: false, error: 'Order cannot be cancelled at current status' }
    }
    
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })
    
    revalidatePath(`/[locale]/storefront/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Cancel order error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return { success: false, error: 'Please login first' }
    }
    return { success: false, error: 'Failed to cancel order' }
  }
}

// ============================================================
// 管理端操作
// ============================================================

/**
 * 获取管理端订单列表
 */
export async function getAdminOrders(
  params: OrderFilterParams = {}
): Promise<ApiResponse<PaginatedResponse<{
  id: string
  orderNo: string
  customerName: string
  customerPhone: string
  status: string
  statusLabel: string
  itemCount: number
  totalCny: string | null
  totalSar: string | null
  estimatedProfit: string | null
  createdAt: Date
}>>> {
  try {
    await requireAdmin()
    
    const page = params.page || 1
    const pageSize = Math.min(params.pageSize || 20, 100)
    const skip = (page - 1) * pageSize
    
    const where: Record<string, unknown> = {}
    
    if (params.status) {
      where.status = params.status
    }
    
    if (params.userId) {
      where.userId = params.userId
    }
    
    if (params.keyword) {
      where.orderNo = { contains: params.keyword, mode: 'insensitive' }
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, phone: true },
          },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ])
    
    const ordersWithProfit = orders.map(order => {
      // 计算预估毛利
      let estimatedProfit: string | null = null
      if (order.totalCny && order.markupRatio) {
        const profit = new Decimal(order.totalCny.toString())
          .mul(new Decimal(order.markupRatio.toString()).sub(1))
          .sub(new Decimal(order.shippingCostCny?.toString() || 0))
        estimatedProfit = profit.toDecimalPlaces(2).toString()
      }
      
      const statusKey = order.status as keyof typeof ORDER_STATUS_CONFIG
      
      return {
        id: order.id,
        orderNo: order.orderNo,
        customerName: order.user.name,
        customerPhone: order.user.phone,
        status: order.status,
        statusLabel: ORDER_STATUS_CONFIG[statusKey]?.label_zh || order.status,
        itemCount: order._count.items,
        totalCny: order.totalCny?.toString() || null,
        totalSar: order.totalSar?.toString() || null,
        estimatedProfit,
        createdAt: order.createdAt,
      }
    })
    
    return {
      success: true,
      data: {
        items: ordersWithProfit,
        total,
        hasMore: skip + orders.length < total,
      },
    }
  } catch (error) {
    console.error('Get admin orders error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to fetch orders' }
  }
}

/**
 * 获取管理端订单详情
 */
export async function getAdminOrderDetail(
  orderId: string
): Promise<ApiResponse<{
  id: string
  orderNo: string
  status: string
  statusLabel: string
  exchangeRate: string | null
  markupRatio: string | null
  totalCny: string | null
  totalSar: string | null
  overrideTotalSar: string | null
  shippingCostCny: string | null
  settlementTotalCny: string | null
  settlementTotalSar: string | null
  totalAmountSar: string | null
  estimatedProfit: string | null
  actualProfit: string | null
  createdAt: Date
  confirmedAt: Date | null
  customer: {
    id: string
    name: string
    phone: string
    markupRatio: string
  }
  items: Array<{
    id: string
    skuId: string
    productNameSnapshot: string
    skuDescSnapshot: string
    quantity: number
    unitPriceCny: string | null
    unitPriceSar: string | null
    /** 仅当 unitPriceCny 为空时：报价页建议成本（历史报价或 SKU 参考价换算） */
    suggestedCostCny: string | null
    itemStatus: string
    productImage: string | null
    supplier: string | null
    supplierLink: string | null
    spuCode: string | null
    settlementQty: number | null
    settlementPriceCny: string | null
    settlementPriceSar: string | null
    isReturned: boolean
  }>
  payments: Array<{
    id: string
    amountSar: string
    method: string
    proofUrl: string | null
    note: string | null
    confirmedAt: Date
  }>
  shipping: {
    id: string
    trackingNo: string | null
    trackingUrl: string | null
    method: string | null
    note: string | null
  } | null
}>> {
  try {
    await requireAdmin()
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            sku: {
              include: {
                product: {
                  select: {
                    spuCode: true,
                    images: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                    supplier: true,
                    supplierLink: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        shipping: true,
      },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 计算毛利
    let estimatedProfit: string | null = null
    let actualProfit: string | null = null
    
    if (order.totalCny && order.markupRatio) {
      estimatedProfit = new Decimal(order.totalCny.toString())
        .mul(new Decimal(order.markupRatio.toString()).sub(1))
        .sub(new Decimal(order.shippingCostCny?.toString() || 0))
        .toDecimalPlaces(2)
        .toString()
    }
    
    // 实际毛利（如果有结算数据）
    // 新逻辑：实际毛利 = 结算总额(CNY) - 结算总成本(CNY)
    // 结算总成本 = 各商品(成本单价 × 结算数量)之和
    if (order.settlementTotalCny && order.items.length > 0) {
      // 计算结算总成本
      let settlementTotalCost = new Decimal(0)
      for (const item of order.items) {
        if (item.unitPriceCny && item.settlementQty !== null && item.settlementQty !== undefined) {
          settlementTotalCost = settlementTotalCost.add(
            new Decimal(item.unitPriceCny.toString()).mul(item.settlementQty)
          )
        }
      }
      
      actualProfit = new Decimal(order.settlementTotalCny.toString())
        .sub(settlementTotalCost)
        .sub(new Decimal(order.shippingCostCny?.toString() || 0))
        .toDecimalPlaces(2)
        .toString()
    }
    
    const statusKey = order.status as keyof typeof ORDER_STATUS_CONFIG

    let rateForReference = DEFAULT_EXCHANGE_RATE
    if (order.exchangeRate) {
      rateForReference = new Decimal(order.exchangeRate.toString()).toNumber()
    } else {
      const latestRateOrder = await prisma.order.findFirst({
        where: { exchangeRate: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { exchangeRate: true },
      })
      if (latestRateOrder?.exchangeRate) {
        rateForReference = new Decimal(latestRateOrder.exchangeRate.toString()).toNumber()
      }
    }

    const suggestedCostCnyByItemId = await getSuggestedCostCnyByOrderItemId({
      orderId: order.id,
      rateForReference,
      lineItems: order.items.map((i) => ({
        id: i.id,
        skuId: i.skuId,
        unitPriceCny: i.unitPriceCny,
      })),
    })
    
    return {
      success: true,
      data: {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        statusLabel: ORDER_STATUS_CONFIG[statusKey]?.label_zh || order.status,
        exchangeRate: order.exchangeRate?.toString() || null,
        markupRatio: order.markupRatio?.toString() || null,
        totalCny: order.totalCny?.toString() || null,
        totalSar: order.totalSar?.toString() || null,
        overrideTotalSar: order.overrideTotalSar?.toString() || null,
        shippingCostCny: order.shippingCostCny?.toString() || null,
        // 结算字段
        settlementTotalCny: order.settlementTotalCny?.toString() || null,
        settlementTotalSar: order.settlementTotalSar?.toString() || null,
        totalAmountSar: order.totalAmountSar?.toString() || null,
        estimatedProfit,
        actualProfit,
        createdAt: order.createdAt,
        confirmedAt: order.confirmedAt,
        customer: {
          id: order.user.id,
          name: order.user.name,
          phone: order.user.phone,
          markupRatio: order.user.markupRatio.toString(),
        },
        items: order.items.map(item => {
          // 计算结算单价(SAR) = 结算单价(CNY) × 汇率
          let settlementPriceSar: string | null = null
          if (item.settlementPriceCny && order.exchangeRate) {
            settlementPriceSar = new Decimal(item.settlementPriceCny.toString())
              .mul(order.exchangeRate.toString())
              .toDecimalPlaces(2)
              .toString()
          }

          const suggestedCostCny = item.unitPriceCny
            ? null
            : (suggestedCostCnyByItemId.get(item.id) ?? null)
          
          return {
            id: item.id,
            skuId: item.skuId,
            productNameSnapshot: item.productNameSnapshot,
            skuDescSnapshot: item.skuDescSnapshot,
            quantity: item.quantity,
            unitPriceCny: item.unitPriceCny?.toString() || null,
            unitPriceSar: item.unitPriceSar?.toString() || null,
            suggestedCostCny,
            itemStatus: item.itemStatus,
            productImage: item.sku.product.images[0]?.url || null,
            supplier: item.sku.product.supplier || null,
            supplierLink: item.sku.product.supplierLink || null,
            spuCode: item.sku.product.spuCode || null,
            // 结算字段
            settlementQty: item.settlementQty ?? null,
            settlementPriceCny: item.settlementPriceCny?.toString() || null,
            settlementPriceSar,
            isReturned: item.itemStatus === 'RETURNED',
          }
        }),
        payments: order.payments.map(p => ({
          id: p.id,
          amountSar: p.amountSar.toString(),
          method: p.method,
          proofUrl: p.proofUrl,
          note: p.note,
          confirmedAt: p.confirmedAt,
        })),
        shipping: order.shipping ? {
          id: order.shipping.id,
          trackingNo: order.shipping.trackingNo,
          trackingUrl: order.shipping.trackingUrl,
          method: order.shipping.method,
          note: order.shipping.note,
        } : null,
      },
    }
  } catch (error) {
    console.error('Get admin order detail error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to fetch order detail' }
  }
}

/**
 * 提交报价
 */
export async function submitQuote(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = submitQuoteSchema.safeParse({ orderId, ...data as Record<string, unknown> })
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, submitQuoteFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 允许 PENDING_QUOTE、NEGOTIATING 或 QUOTED 状态（QUOTED 可重新报价）
    const allowedStatuses = ['PENDING_QUOTE', 'NEGOTIATING', 'QUOTED']
    if (!allowedStatuses.includes(order.status)) {
      return { success: false, error: 'Order cannot be quoted at current status' }
    }
    
    const exchangeRate = validated.exchangeRate
    const markupRatio = validated.markupRatio
    
    // 构建 item 价格映射（包含 CNY 和可选的 SAR）
    const itemPriceMap = new Map(
      validated.items.map(item => [item.orderItemId, { unitPriceCny: item.unitPriceCny, unitPriceSar: item.unitPriceSar }])
    )
    
    await prisma.$transaction(async (tx) => {
      let totalCny = new Decimal(0)
      let totalSar = new Decimal(0)
      
      // 更新每个 item
      for (const orderItem of order.items) {
        // 跳过已删除商品
        if (orderItem.itemStatus === 'CUSTOMER_REMOVED') continue

        const itemData = itemPriceMap.get(orderItem.id)
        
        if (itemData !== undefined) {
          const unitPriceCny = itemData.unitPriceCny
          // 如果有手动客户单价，使用手动值；否则自动计算
          const unitPriceSar = itemData.unitPriceSar
            ? new Decimal(itemData.unitPriceSar)
            : new Decimal(calculateCustomerPrice(unitPriceCny, markupRatio, exchangeRate))
          
          // 累加总价
          totalCny = totalCny.add(new Decimal(unitPriceCny).mul(orderItem.quantity))
          totalSar = totalSar.add(unitPriceSar.mul(orderItem.quantity))
          
          // 更新 item
          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: {
              unitPriceCny: new Decimal(unitPriceCny),
              unitPriceSar: unitPriceSar,
              itemStatus: 'QUOTED',
            },
          })
        }
      }
      
      // 使用 overrideTotalSar 如果提供
      const finalTotalSar = validated.overrideTotalSar
        ? new Decimal(validated.overrideTotalSar)
        : totalSar
      
      // 更新订单
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'QUOTED',
          exchangeRate: new Decimal(exchangeRate),
          markupRatio: new Decimal(markupRatio),
          totalCny: totalCny.toDecimalPlaces(2),
          totalSar: finalTotalSar.toDecimalPlaces(2),
          overrideTotalSar: validated.overrideTotalSar
            ? new Decimal(validated.overrideTotalSar)
            : null,
        },
      })
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Submit quote error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to submit quote' }
  }
}

/**
 * 付款前调整订单
 */
export async function adjustOrderBeforePayment(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = adjustOrderSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, adjustOrderFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 仅允许 QUOTED 或 CONFIRMED 状态
    const allowedStatuses = ['QUOTED', 'CONFIRMED']
    if (!allowedStatuses.includes(order.status)) {
      return { success: false, error: 'Order cannot be adjusted at current status' }
    }
    
    if (!validated.items || validated.items.length === 0) {
      return { success: true }
    }
    
    const exchangeRate = order.exchangeRate?.toString()
    const markupRatio = order.markupRatio?.toString()
    
    if (!exchangeRate || !markupRatio) {
      return { success: false, error: 'Order not quoted yet' }
    }
    
    await prisma.$transaction(async (tx) => {
      let totalCny = new Decimal(0)
      let totalSar = new Decimal(0)
      
      for (const adjustment of validated.items!) {
        const item = order.items.find(i => i.id === adjustment.orderItemId)
        if (!item) continue
        
        const updateData: Record<string, unknown> = {}
        
        // 更新数量
        if (adjustment.quantity !== undefined) {
          updateData.quantity = adjustment.quantity
        }
        
        // 更新价格
        let unitPriceCny = item.unitPriceCny?.toString()
        if (adjustment.unitPriceCny !== undefined) {
          unitPriceCny = adjustment.unitPriceCny
          updateData.unitPriceCny = new Decimal(adjustment.unitPriceCny)
          
          // 重新计算 SAR 价格
          const unitPriceSar = calculateCustomerPrice(
            adjustment.unitPriceCny,
            markupRatio,
            exchangeRate
          )
          updateData.unitPriceSar = new Decimal(unitPriceSar)
        }
        
        if (Object.keys(updateData).length > 0) {
          await tx.orderItem.update({
            where: { id: adjustment.orderItemId },
            data: updateData,
          })
        }
        
        // 使用更新后的值计算总价
        const finalQty = adjustment.quantity ?? item.quantity
        const finalPriceCny = adjustment.unitPriceCny ?? unitPriceCny
        
        if (finalPriceCny) {
          totalCny = totalCny.add(new Decimal(finalPriceCny).mul(finalQty))
          const finalPriceSar = calculateCustomerPrice(finalPriceCny, markupRatio, exchangeRate)
          totalSar = totalSar.add(new Decimal(finalPriceSar).mul(finalQty))
        }
      }
      
      // 更新订单总价
      await tx.order.update({
        where: { id: orderId },
        data: {
          totalCny: totalCny.toDecimalPlaces(2),
          totalSar: totalSar.toDecimalPlaces(2),
        },
      })
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Adjust order error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to adjust order' }
  }
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = updateOrderStatusSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, updateOrderStatusFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 验证状态流转
    if (!isValidStatusTransition(order.status, validated.status)) {
      return { success: false, error: `Invalid status transition from ${order.status} to ${validated.status}` }
    }
    
    const updateData: Record<string, unknown> = { status: validated.status }
    
    // 设置完成时间
    if (validated.status === 'COMPLETED') {
      updateData.completedAt = new Date()
    }
    
    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Update order status error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to update order status' }
  }
}

/**
 * 管理员取消订单
 */
export async function adminCancelOrder(
  orderId: string
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 管理员可以取消任何状态的订单
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Admin cancel order error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to cancel order' }
  }
}

/**
 * 获取最近一次报价的默认值（汇率和加价比例）
 * 用于首次报价时的默认值填充
 */
export async function getLatestQuoteDefaults(): Promise<ApiResponse<{
  exchangeRate: string | null
  markupRatio: string | null
}>> {
  try {
    await requireAdmin()
    
    // 查询最近一个有汇率的订单（按创建时间倒序）
    const latestOrder = await prisma.order.findFirst({
      where: {
        exchangeRate: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        exchangeRate: true,
        markupRatio: true,
      },
    })
    
    return {
      success: true,
      data: {
        exchangeRate: latestOrder?.exchangeRate?.toString() || null,
        markupRatio: latestOrder?.markupRatio?.toString() || null,
      },
    }
  } catch (error) {
    console.error('Get latest quote defaults error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to fetch latest quote defaults' }
  }
}

/**
 * 删除订单（仅允许删除已取消状态的订单）
 * 管理员和客户都可以调用
 */
export async function deleteOrder(
  orderId: string
): Promise<ApiResponse<void>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Please login first' }
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 验证权限（客户只能删除自己的订单）
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    // 仅允许删除已取消状态的订单
    if (order.status !== 'CANCELLED') {
      return { success: false, error: '只能删除已取消的订单' }
    }
    
    // 删除订单（关联数据会通过 onDelete: Cascade 自动删除）
    await prisma.order.delete({
      where: { id: orderId },
    })
    
    revalidatePath('/admin/orders')
    revalidatePath('/[locale]/storefront/orders')
    
    return { success: true }
  } catch (error) {
    console.error('Delete order error:', error)
    return { success: false, error: 'Failed to delete order' }
  }
}
