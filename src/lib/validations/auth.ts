import { z } from 'zod'

export const loginSchema = z.object({
  phone: z.string().min(5, 'Phone number is required').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  phone: z.string().min(5, 'Phone number is required').max(20),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  company: z.string().max(200).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
