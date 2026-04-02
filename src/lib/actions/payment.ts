'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { addPaymentSchema } from '@/lib/validations/order'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import type { ApiResponse } from '@/types'
import { revalidatePath } from 'next/cache'
import Decimal from 'decimal.js'
import type { OrderStatus } from '@prisma/client'

// ============================================================
// 字段名映射
// ============================================================

/** addPayment 字段名映射 */
const addPaymentFieldNameMap: Record<string, string> = {
  amountSar: '付款金额',
  method: '付款方式',
  proofUrl: '付款凭证',
  note: '备注',
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
 * 添加付款记录
 */
export async function addPayment(
  orderId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = addPaymentSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, addPaymentFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 验证订单状态允许付款
    const payableStatuses = ['CONFIRMED', 'PARTIALLY_PAID', 'SETTLING']
    if (!payableStatuses.includes(order.status)) {
      return { success: false, error: 'Order is not ready for payment' }
    }
    
    // 创建付款记录
    await prisma.payment.create({
      data: {
        orderId,
        amountSar: new Decimal(validated.amountSar),
        method: validated.method,
        proofUrl: validated.proofUrl,
        note: validated.note,
      },
    })
    
    // 重新查询所有付款记录计算总额
    const allPayments = await prisma.payment.findMany({
      where: { orderId },
    })
    
    const totalPaid = allPayments.reduce(
      (sum, p) => sum.add(new Decimal(p.amountSar.toString())),
      new Decimal(0)
    )
    
    // 获取订单总价：优先使用 totalAmountSar（结算确认后的金额），其次 overrideTotalSar，最后 totalSar
    const orderTotalSar = order.totalAmountSar?.toString()
      || order.overrideTotalSar?.toString() 
      || order.totalSar?.toString() 
      || '0'
    
    // 判断付款状态（SETTLING 状态下保持状态不变）
    let newStatus: OrderStatus | null = null
    
    // 如果当前是 SETTLING 状态，保持 SETTLING 不变
    if (order.status === 'SETTLING') {
      newStatus = null  // 不更新状态
    } else {
      const totalPaidNum = totalPaid.toDecimalPlaces(2)
      const orderTotalNum = new Decimal(orderTotalSar).toDecimalPlaces(2)
      
      if (totalPaidNum.greaterThanOrEqualTo(orderTotalNum)) {
        newStatus = 'FULLY_PAID'
      } else if (totalPaidNum.greaterThan(0)) {
        newStatus = 'PARTIALLY_PAID'
      }
    }
    
    // 更新订单状态
    if (newStatus) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      })
    }
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Add payment error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to add payment' }
  }
}

/**
 * 获取订单付款记录
 */
export async function getOrderPayments(
  orderId: string
): Promise<ApiResponse<Array<{
  id: string
  amountSar: string
  method: string
  proofUrl: string | null
  note: string | null
  confirmedAt: Date
  createdAt: Date
}>>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: 'Please login first' }
    }
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 客户只能查看自己的订单付款
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
    
    return {
      success: true,
      data: payments.map(p => ({
        id: p.id,
        amountSar: p.amountSar.toString(),
        method: p.method,
        proofUrl: p.proofUrl,
        note: p.note,
        confirmedAt: p.confirmedAt,
        createdAt: p.createdAt,
      })),
    }
  } catch (error) {
    console.error('Get order payments error:', error)
    return { success: false, error: 'Failed to fetch payments' }
  }
}

/**
 * 删除付款记录（管理员）
 */
export async function deletePayment(
  paymentId: string
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    })
    
    if (!payment) {
      return { success: false, error: 'Payment not found' }
    }
    
    const orderId = payment.orderId
    
    // 删除付款记录
    await prisma.payment.delete({
      where: { id: paymentId },
    })
    
    // 重新计算付款状态
    const remainingPayments = await prisma.payment.findMany({
      where: { orderId },
    })
    
    const totalPaid = remainingPayments.reduce(
      (sum, p) => sum.add(new Decimal(p.amountSar.toString())),
      new Decimal(0)
    )
    
    // 获取订单总价：优先使用 totalAmountSar（结算确认后的金额），其次 overrideTotalSar，最后 totalSar
    const orderTotalSar = payment.order.totalAmountSar?.toString()
      || payment.order.overrideTotalSar?.toString() 
      || payment.order.totalSar?.toString() 
      || '0'
    
    // 判断新的付款状态（SETTLING 状态下保持状态不变）
    let newStatus: OrderStatus | null = null
    
    // 如果当前是 SETTLING 状态，保持 SETTLING 不变
    if (payment.order.status === 'SETTLING') {
      newStatus = null  // 不更新状态
    } else {
      const totalPaidNum = totalPaid.toDecimalPlaces(2)
      const orderTotalNum = new Decimal(orderTotalSar).toDecimalPlaces(2)
      
      if (totalPaidNum.greaterThanOrEqualTo(orderTotalNum)) {
        newStatus = 'FULLY_PAID'
      } else if (totalPaidNum.greaterThan(0)) {
        newStatus = 'PARTIALLY_PAID'
      } else {
        // 没有付款记录，回到 CONFIRMED 状态
        newStatus = 'CONFIRMED'
      }
    }
    
    // 更新订单状态
    if (newStatus) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
      })
    }
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Delete payment error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to delete payment' }
  }
}
