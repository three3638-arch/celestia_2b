import { z } from 'zod'

// 审核客户 Schema
export const approveCustomerSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  markupRatio: z.number().positive('加价比例必须大于0'),
})

// 更新加价比例 Schema
export const updateMarkupRatioSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  markupRatio: z.number().positive('加价比例必须大于0'),
})

// 重置密码 Schema
export const resetPasswordSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  newPassword: z.string().min(6, '密码长度至少6位'),
})

export type ApproveCustomerInput = z.infer<typeof approveCustomerSchema>
export type UpdateMarkupRatioInput = z.infer<typeof updateMarkupRatioSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
