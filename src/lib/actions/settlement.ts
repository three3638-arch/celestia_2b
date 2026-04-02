'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { updateSettlementSchema } from '@/lib/validations/settlement'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import { calculateCustomerPrice } from '@/lib/decimal'
import type { ApiResponse } from '@/types'
import { revalidatePath } from 'next/cache'
import Decimal from 'decimal.js'
import type { z } from 'zod'

// 字段名映射
const settlementFieldNameMap: Record<string, string> = {
  items: '结算项',
  'items.orderItemId': '订单项ID',
  'items.settlementQty': '结算数量',
  'items.settlementPriceSar': '结算单价(SAR)',
  'items.isReturned': '退货标记',
  'items.note': '备注',
  settlementNote: '结算备注',
  discountCny: '整单折扣',
}

// ============================================================
// 辅助函数
// ============================================================

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
 * 计算结算单价 CNY（从 SAR 反算，只除以汇率，不涉及加价比例）
 * 公式：结算单价(CNY) = 结算单价(SAR) / exchangeRate
 */
function calculateSettlementPriceCny(
  priceSar: string,
  exchangeRate: string
): string {
  const priceSarDecimal = new Decimal(priceSar)
  const exchangeRateDecimal = new Decimal(exchangeRate)
  return priceSarDecimal.div(exchangeRateDecimal).toFixed(2)
}

// ============================================================
// 结算操作
// ============================================================

/**
 * 结算明细项
 */
export interface SettlementItemDetail {
  id: string
  orderItemId: string
  productNameSnapshot: string
  skuDescSnapshot: string
  productImage: string | null
  // 报价数据
  quoteQty: number
  quotePriceCny: string | null  // 成本单价(CNY) - 只读展示
  quotePriceSar: string | null
  quoteSubtotalCny: string | null
  quoteSubtotalSar: string | null
  // 结算数据
  settlementQty: number
  settlementPriceSar: string      // 结算单价(SAR) - 管理员输入
  settlementPriceCny: string      // 结算单价(CNY) - 自动计算 = SAR / 汇率
  unitProfit: string              // 单件毛利 = 结算单价(CNY) - 成本单价(CNY)
  settlementSubtotalCny: string
  settlementSubtotalSar: string
  // 状态
  isReturned: boolean
  itemStatus: string
  note: string | null
}

/**
 * 结算详情响应
 */
export interface SettlementDetail {
  orderId: string
  orderNo: string
  status: string
  exchangeRate: string | null
  markupRatio: string | null
  // 报价汇总
  quoteTotalCny: string
  quoteTotalSar: string
  // 结算汇总
  settlementTotalCny: string
  settlementTotalSar: string
  // 客户已付总额
  paidTotalSar: string
  // 应补款/应退款（结算应付总额 - 客户已付总额）
  balanceDueSar: string       // 正数=客户需补款，负数=需退款给客户
  // 成本与毛利汇总
  totalCostCny: string        // 结算总成本(CNY) = Σ(成本单价 × 结算数量)
  totalProfit: string         // 总毛利 = Σ(单件毛利 × 结算数量)
  // 折扣
  discountCny: string
  // 差异（结算总额 - 报价总额）
  differenceCny: string
  differenceSar: string
  // 备注
  settlementNote: string | null
  // 明细项
  items: SettlementItemDetail[]
}

/**
 * 获取结算详情
 * 仅 ADMIN 可访问
 * 订单状态必须在 SHIPPED/SETTLING/COMPLETED 之一
 */
export async function getSettlementDetail(
  orderId: string
): Promise<ApiResponse<SettlementDetail>> {
  try {
    await requireAdmin()

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
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    // 验证订单状态
    const allowedStatuses = ['SHIPPED', 'SETTLING', 'COMPLETED']
    if (!allowedStatuses.includes(order.status)) {
      return { 
        success: false, 
        error: 'Order must be in SHIPPED, SETTLING, or COMPLETED status to view settlement' 
      }
    }

    // 验证报价数据
    if (!order.exchangeRate || !order.markupRatio) {
      return { success: false, error: 'Order has not been quoted yet' }
    }

    const exchangeRate = order.exchangeRate.toString()
    const markupRatio = order.markupRatio.toString()

    // 计算报价汇总
    let quoteTotalCny = new Decimal(0)
    let quoteTotalSar = new Decimal(0)

    const items: SettlementItemDetail[] = order.items.map(item => {
      // 报价数据
      const quotePriceCny = item.unitPriceCny?.toString() || '0'
      const quotePriceSar = item.unitPriceSar?.toString() || '0'
      const quoteSubtotalCny = new Decimal(quotePriceCny).mul(item.quantity).toFixed(2)
      const quoteSubtotalSar = new Decimal(quotePriceSar).mul(item.quantity).toFixed(1)

      quoteTotalCny = quoteTotalCny.add(quoteSubtotalCny)
      quoteTotalSar = quoteTotalSar.add(quoteSubtotalSar)

      // 结算数据
      const isReturned = item.itemStatus === 'RETURNED'
      const settlementQty = item.settlementQty ?? (isReturned ? 0 : item.quantity)
      
      // 如果已有结算数据，从 settlementPriceCny 反算 settlementPriceSar
      // 否则默认使用报价的 SAR 价格
      let settlementPriceSar: string
      let settlementPriceCny: string
      
      if (item.settlementPriceCny) {
        // 已有结算数据：从 CNY 反算 SAR = CNY * exchangeRate
        settlementPriceCny = item.settlementPriceCny.toString()
        settlementPriceSar = new Decimal(settlementPriceCny).mul(exchangeRate).toFixed(2)
      } else {
        // 默认使用报价价格
        settlementPriceSar = quotePriceSar
        settlementPriceCny = calculateSettlementPriceCny(settlementPriceSar, exchangeRate)
      }
      
      // 计算单件毛利 = 结算单价(CNY) - 成本单价(CNY)
      const unitProfit = new Decimal(settlementPriceCny).sub(quotePriceCny).toFixed(2)
      
      const settlementSubtotalCny = new Decimal(settlementPriceCny).mul(settlementQty).toFixed(2)
      const settlementSubtotalSar = new Decimal(settlementPriceSar).mul(settlementQty).toFixed(2)

      return {
        id: item.id,
        orderItemId: item.id,
        productNameSnapshot: item.productNameSnapshot,
        skuDescSnapshot: item.skuDescSnapshot,
        productImage: item.sku.product.images[0]?.url || null,
        // 报价
        quoteQty: item.quantity,
        quotePriceCny: quotePriceCny || null,
        quotePriceSar: quotePriceSar || null,
        quoteSubtotalCny: quoteSubtotalCny,
        quoteSubtotalSar: quoteSubtotalSar,
        // 结算
        settlementQty,
        settlementPriceSar,
        settlementPriceCny,
        unitProfit,
        settlementSubtotalCny,
        settlementSubtotalSar,
        // 状态
        isReturned,
        itemStatus: item.itemStatus,
        note: item.settlementNote || null,
      }
    })

    // 计算结算汇总
    let settlementTotalCny = new Decimal(0)
    let settlementTotalSar = new Decimal(0)
    let totalCostCny = new Decimal(0)
    let totalProfit = new Decimal(0)

    for (const item of items) {
      settlementTotalCny = settlementTotalCny.add(item.settlementSubtotalCny)
      settlementTotalSar = settlementTotalSar.add(item.settlementSubtotalSar)
      // 计算总成本 = 成本单价 × 结算数量
      const itemCost = new Decimal(item.quotePriceCny || '0').mul(item.settlementQty)
      totalCostCny = totalCostCny.add(itemCost)
      // 计算总毛利 = 单件毛利 × 结算数量
      const itemProfit = new Decimal(item.unitProfit).mul(item.settlementQty)
      totalProfit = totalProfit.add(itemProfit)
    }

    // 使用订单记录的结算总额（如果有）
    const finalSettlementCny = order.settlementTotalCny?.toString() || settlementTotalCny.toFixed(2)
    const finalSettlementSar = order.settlementTotalSar?.toString() || settlementTotalSar.toFixed(2)

    // 计算差异
    const differenceCny = new Decimal(finalSettlementCny).sub(quoteTotalCny).toFixed(2)
    const differenceSar = new Decimal(finalSettlementSar).sub(quoteTotalSar).toFixed(2)

    // 计算客户已付总额
    const paidTotalSar = order.payments.reduce(
      (sum, p) => sum.add(p.amountSar),
      new Decimal(0)
    ).toFixed(2)

    // 计算应补款/应退款 = 结算应付总额 - 客户已付总额
    const balanceDueSar = new Decimal(finalSettlementSar).sub(paidTotalSar).toFixed(2)

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        status: order.status,
        exchangeRate,
        markupRatio,
        quoteTotalCny: quoteTotalCny.toFixed(2),
        quoteTotalSar: quoteTotalSar.toFixed(2),
        settlementTotalCny: finalSettlementCny,
        settlementTotalSar: finalSettlementSar,
        paidTotalSar,
        balanceDueSar,
        totalCostCny: totalCostCny.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        discountCny: '0', // 暂不实现折扣
        differenceCny,
        differenceSar,
        settlementNote: order.settlementNote,
        items,
      },
    }
  } catch (error) {
    console.error('Get settlement detail error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to fetch settlement detail' }
  }
}

/**
 * 更新结算
 * 逐项更新：结算数量、结算单价(CNY)、退货标记、备注
 */
export async function updateSettlement(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 使用 safeParse 进行验证，返回字段级错误
    const validation = updateSettlementSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, settlementFieldNameMap) }
    }
    const validated = validation.data

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    // 验证订单状态
    const allowedStatuses = ['SHIPPED', 'SETTLING']
    if (!allowedStatuses.includes(order.status)) {
      return { 
        success: false, 
        error: 'Order must be in SHIPPED or SETTLING status to update settlement' 
      }
    }

    // 验证报价数据
    if (!order.exchangeRate) {
      return { success: false, error: 'Order has not been quoted yet' }
    }

    const exchangeRate = order.exchangeRate.toString()

    // 构建 item 映射
    const itemMap = new Map(order.items.map(item => [item.id, item]))
    const inputMap = new Map(validated.items.map(item => [item.orderItemId, item]))

    // 计算结算总额
    let settlementTotalCny = new Decimal(0)
    let settlementTotalSar = new Decimal(0)

    await prisma.$transaction(async (tx) => {
      // 更新每个 item
      for (const orderItem of order.items) {
        const input = inputMap.get(orderItem.id)
        if (!input) continue

        const isReturned = input.isReturned
        const settlementQty = isReturned ? 0 : input.settlementQty
        const settlementPriceSar = input.settlementPriceSar

        // 反算 CNY 价格：结算单价(CNY) = 结算单价(SAR) / exchangeRate
        const settlementPriceCny = calculateSettlementPriceCny(settlementPriceSar, exchangeRate)

        // 计算小计
        const subtotalCny = new Decimal(settlementPriceCny).mul(settlementQty).toFixed(2)
        const subtotalSar = new Decimal(settlementPriceSar).mul(settlementQty).toFixed(2)

        settlementTotalCny = settlementTotalCny.add(subtotalCny)
        settlementTotalSar = settlementTotalSar.add(subtotalSar)

        // 确定 item 状态
        let newItemStatus = orderItem.itemStatus
        if (isReturned) {
          newItemStatus = 'RETURNED'
        } else if (settlementQty !== orderItem.quantity) {
          newItemStatus = 'QTY_ADJUSTED'
        }

        // 更新 item
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            settlementQty,
            settlementPriceCny: new Decimal(settlementPriceCny),
            settlementNote: input.note || null,
            itemStatus: newItemStatus,
          },
        })
      }

      // 更新订单
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'SETTLING',
          settlementTotalCny: settlementTotalCny.toDecimalPlaces(2),
          settlementTotalSar: settlementTotalSar.toDecimalPlaces(2),
          settlementNote: validated.settlementNote || null,
        },
      })
    })

    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath(`/admin/orders/${orderId}/settlement`)

    return { success: true }
  } catch (error) {
    console.error('Update settlement error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to update settlement' }
  }
}

/**
 * 确认结算
 * 锁定结算数据，订单状态改为 COMPLETED
 * 将 settlementTotalSar 写入 totalAmountSar 作为最终应付金额
 */
export async function confirmSettlement(
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

    // 验证订单状态
    if (order.status !== 'SETTLING') {
      return { 
        success: false, 
        error: 'Order must be in SETTLING status to confirm settlement' 
      }
    }

    // 更新订单状态为 COMPLETED，并将 settlementTotalSar 写入 totalAmountSar
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalAmountSar: order.settlementTotalSar,
      },
    })

    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath(`/admin/orders/${orderId}/settlement`)

    return { success: true }
  } catch (error) {
    console.error('Confirm settlement error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to confirm settlement' }
  }
}

/**
 * 获取客户可见的结算摘要（用于客户端订单详情页）
 */
export interface CustomerSettlementSummary {
  // 报价汇总
  quoteTotalSar: string
  // 结算汇总
  settlementTotalSar: string
  // 差异
  differenceSar: string
  // 备注
  settlementNote: string | null
  // 明细项
  items: Array<{
    productNameSnapshot: string
    skuDescSnapshot: string
    quoteQty: number
    quotePriceSar: string | null
    settlementQty: number
    settlementPriceSar: string
    difference: string
    isReturned: boolean
    itemStatus: string
  }>
}

/**
 * 获取客户可见的结算摘要
 */
export async function getCustomerSettlementSummary(
  orderId: string
): Promise<ApiResponse<CustomerSettlementSummary>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Please login first' }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    // 验证权限（客户只能看自己的订单）
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }

    // 仅在 SETTLING 或 COMPLETED 状态显示结算信息
    if (!['SETTLING', 'COMPLETED'].includes(order.status)) {
      return { success: false, error: 'Settlement not available' }
    }

    // 验证报价数据
    if (!order.exchangeRate || !order.settlementTotalSar) {
      return { success: false, error: 'Settlement data incomplete' }
    }

    const exchangeRate = order.exchangeRate.toString()

    // 计算报价总额 SAR
    let quoteTotalSar = new Decimal(0)
    const items = order.items.map(item => {
      const quotePriceSar = item.unitPriceSar?.toString() || '0'
      const quoteSubtotalSar = new Decimal(quotePriceSar).mul(item.quantity)
      quoteTotalSar = quoteTotalSar.add(quoteSubtotalSar)

      const isReturned = item.itemStatus === 'RETURNED'
      const settlementQty = item.settlementQty ?? 0
      
      // 从 settlementPriceCny 反算 settlementPriceSar
      let settlementPriceSar: string
      if (item.settlementPriceCny) {
        settlementPriceSar = new Decimal(item.settlementPriceCny.toString()).mul(exchangeRate).toFixed(2)
      } else {
        settlementPriceSar = quotePriceSar
      }
      
      const settlementSubtotalSar = new Decimal(settlementPriceSar).mul(settlementQty)

      const difference = settlementSubtotalSar.sub(quoteSubtotalSar).toFixed(2)

      return {
        productNameSnapshot: item.productNameSnapshot,
        skuDescSnapshot: item.skuDescSnapshot,
        quoteQty: item.quantity,
        quotePriceSar: quotePriceSar || null,
        settlementQty,
        settlementPriceSar,
        difference,
        isReturned,
        itemStatus: item.itemStatus,
      }
    })

    const settlementTotalSar = order.settlementTotalSar.toString()
    const differenceSar = new Decimal(settlementTotalSar).sub(quoteTotalSar).toFixed(2)

    return {
      success: true,
      data: {
        quoteTotalSar: quoteTotalSar.toFixed(2),
        settlementTotalSar,
        differenceSar,
        settlementNote: order.settlementNote,
        items,
      },
    }
  } catch (error) {
    console.error('Get customer settlement summary error:', error)
    return { success: false, error: 'Failed to fetch settlement summary' }
  }
}
