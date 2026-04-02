'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { addShippingSchema } from '@/lib/validations/order'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import type { ApiResponse } from '@/types'
import { revalidatePath } from 'next/cache'
import Decimal from 'decimal.js'

// ============================================================
// 字段名映射
// ============================================================

/** addShipping 字段名映射 */
const addShippingFieldNameMap: Record<string, string> = {
  trackingNo: '物流单号',
  trackingUrl: '物流链接',
  method: '物流方式',
  shippingCostCny: '运费(人民币)',
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
 * 添加物流信息
 */
export async function addShipping(
  orderId: string,
  data: unknown
): Promise<ApiResponse<{ shippingId: string }>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = addShippingSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, addShippingFieldNameMap) }
    }
    
    const validated = validation.data
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipping: true },
    })
    
    if (!order) {
      return { success: false, error: 'Order not found' }
    }
    
    // 验证订单状态允许发货
    const shippableStatuses = ['FULLY_PAID', 'PARTIALLY_PAID']
    if (!shippableStatuses.includes(order.status)) {
      return { success: false, error: 'Order must be paid before shipping' }
    }
    
    // 检查是否已有物流记录
    if (order.shipping) {
      return { success: false, error: 'Shipping record already exists for this order' }
    }
    
    // 创建物流记录
    const shipping = await prisma.$transaction(async (tx) => {
      // 创建物流记录
      const newShipping = await tx.shipping.create({
        data: {
          orderId,
          trackingNo: validated.trackingNo,
          trackingUrl: validated.trackingUrl || null,
          method: validated.method,
          note: validated.note,
        },
      })
      
      // 更新订单运费和状态
      const updateData: Record<string, unknown> = { status: 'SHIPPED' }
      
      if (validated.shippingCostCny !== undefined) {
        updateData.shippingCostCny = new Decimal(validated.shippingCostCny)
      }
      
      await tx.order.update({
        where: { id: orderId },
        data: updateData,
      })
      
      return newShipping
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return {
      success: true,
      data: { shippingId: shipping.id },
    }
  } catch (error) {
    console.error('Add shipping error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to add shipping' }
  }
}

/**
 * 更新物流信息
 */
export async function updateShipping(
  shippingId: string,
  data: unknown
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    // 验证输入数据
    const validation = addShippingSchema.partial().safeParse(data)
    if (!validation.success) {
      return { success: false, error: formatZodErrors(validation.error.issues, addShippingFieldNameMap) }
    }
    
    const validated = validation.data
    
    const shipping = await prisma.shipping.findUnique({
      where: { id: shippingId },
    })
    
    if (!shipping) {
      return { success: false, error: 'Shipping record not found' }
    }
    
    const updateData: Record<string, unknown> = {}
    
    if (validated.trackingNo !== undefined) {
      updateData.trackingNo = validated.trackingNo
    }
    if (validated.trackingUrl !== undefined) {
      updateData.trackingUrl = validated.trackingUrl || null
    }
    if (validated.method !== undefined) {
      updateData.method = validated.method
    }
    if (validated.note !== undefined) {
      updateData.note = validated.note
    }
    
    await prisma.$transaction(async (tx) => {
      // 更新物流记录
      await tx.shipping.update({
        where: { id: shippingId },
        data: updateData,
      })
      
      // 更新订单运费
      if (validated.shippingCostCny !== undefined) {
        await tx.order.update({
          where: { id: shipping.orderId },
          data: {
            shippingCostCny: new Decimal(validated.shippingCostCny),
          },
        })
      }
    })
    
    revalidatePath(`/admin/orders/${shipping.orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Update shipping error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to update shipping' }
  }
}

/**
 * 获取物流信息
 */
export async function getShipping(
  orderId: string
): Promise<ApiResponse<{
  id: string
  trackingNo: string | null
  trackingUrl: string | null
  method: string | null
  note: string | null
  createdAt: Date
  updatedAt: Date
} | null>> {
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
    
    // 客户只能查看自己的订单物流
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      return { success: false, error: 'Access denied' }
    }
    
    const shipping = await prisma.shipping.findUnique({
      where: { orderId },
    })
    
    if (!shipping) {
      return { success: true, data: null }
    }
    
    return {
      success: true,
      data: {
        id: shipping.id,
        trackingNo: shipping.trackingNo,
        trackingUrl: shipping.trackingUrl,
        method: shipping.method,
        note: shipping.note,
        createdAt: shipping.createdAt,
        updatedAt: shipping.updatedAt,
      },
    }
  } catch (error) {
    console.error('Get shipping error:', error)
    return { success: false, error: 'Failed to fetch shipping info' }
  }
}

/**
 * 删除物流记录（管理员）
 */
export async function deleteShipping(
  shippingId: string
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin()
    
    const shipping = await prisma.shipping.findUnique({
      where: { id: shippingId },
    })
    
    if (!shipping) {
      return { success: false, error: 'Shipping record not found' }
    }
    
    const orderId = shipping.orderId
    
    await prisma.$transaction(async (tx) => {
      // 删除物流记录
      await tx.shipping.delete({
        where: { id: shippingId },
      })
      
      // 清除订单运费并回退状态
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'FULLY_PAID',
          shippingCostCny: null,
        },
      })
    })
    
    revalidatePath(`/admin/orders/${orderId}`)
    
    return { success: true }
  } catch (error) {
    console.error('Delete shipping error:', error)
    if (error instanceof Error && error.message === 'Admin access required') {
      return { success: false, error: 'Admin access required' }
    }
    return { success: false, error: 'Failed to delete shipping' }
  }
}
