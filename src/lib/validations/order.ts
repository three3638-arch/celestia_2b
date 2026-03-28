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
  })),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>
