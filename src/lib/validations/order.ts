import { z } from 'zod'

export const createOrderSchema = z.object({
  items: z.array(z.object({
    skuId: z.string(),
    quantity: z.number().int().positive(),
    note: z.string().max(500).optional(),
  })).min(1, 'At least one item is required'),
})

export const submitQuoteSchema = z.object({
  orderId: z.string(),
  exchangeRate: z.string().refine(v => parseFloat(v) > 0, 'Exchange rate must be positive'),
  markupRatio: z.string().refine(v => parseFloat(v) > 0, 'Markup ratio must be positive'),
  items: z.array(z.object({
    orderItemId: z.string(),
    unitPriceCny: z.string().refine(v => parseFloat(v) >= 0, 'Price must be non-negative'),
    unitPriceSar: z.string().refine(v => parseFloat(v) >= 0, 'Price must be non-negative').optional(), // 手动客户单价
  })),
  overrideTotalSar: z.string().optional(),
})

// 客户更新订单
export const customerUpdateOrderSchema = z.object({
  addItems: z.array(z.object({
    skuId: z.string(),
    quantity: z.number().int().positive(),
    note: z.string().max(500).optional(),
  })).optional(),
  removeItemIds: z.array(z.string()).optional(),
  updateItems: z.array(z.object({
    orderItemId: z.string(),
    quantity: z.number().int().positive().optional(),
    note: z.string().max(500).optional(),
  })).optional(),
})

// 付款记录
export const addPaymentSchema = z.object({
  amountSar: z.string().refine(v => parseFloat(v) !== 0, '金额不能为零'),
  method: z.enum(['BANK_TRANSFER', 'WESTERN_UNION', 'CASH', 'OTHER']),
  proofUrl: z.string().optional(),
  note: z.string().max(500).optional(),
})

// 物流信息
export const addShippingSchema = z.object({
  trackingNo: z.string().min(1, '请输入物流单号'),
  trackingUrl: z.string().url().optional().or(z.literal('')),
  method: z.string().min(1, '请输入物流方式'),
  shippingCostCny: z.coerce.number().nonnegative('运费不能为负数').optional(),
  note: z.string().max(500).optional(),
})

// 调整订单（管理端付款前调整）
export const adjustOrderSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.string(),
    unitPriceCny: z.string().optional(),
    quantity: z.number().int().positive().optional(),
  })).optional(),
})

// 更新订单状态
export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING_QUOTE',
    'QUOTED',
    'NEGOTIATING',
    'CONFIRMED',
    'PARTIALLY_PAID',
    'FULLY_PAID',
    'SHIPPED',
    'SETTLING',
    'COMPLETED',
    'CANCELLED',
  ]),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>
export type CustomerUpdateOrderInput = z.infer<typeof customerUpdateOrderSchema>
export type AddPaymentInput = z.infer<typeof addPaymentSchema>
export type AddShippingInput = z.infer<typeof addShippingSchema>
export type AdjustOrderInput = z.infer<typeof adjustOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
