import { z } from 'zod'

// 结算单项 Schema
export const settlementItemSchema = z.object({
  orderItemId: z.string(),
  settlementQty: z.number().int().min(0),
  settlementPriceSar: z.string(), // Decimal string - 管理员输入的结算单价(SAR)
  isReturned: z.boolean().default(false),
  note: z.string().optional(),
})

// 更新结算 Schema
export const updateSettlementSchema = z.object({
  items: z.array(settlementItemSchema).min(1, 'At least one item is required'),
  settlementNote: z.string().optional(),
  discountCny: z.string().optional(), // 整单折扣 (CNY)
})

export type SettlementItemInput = z.infer<typeof settlementItemSchema>
export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>
