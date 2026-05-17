import { z } from 'zod'

export const createProductGroupSchema = z.object({
  name: z.string().min(1).max(50),
})

export const updateProductGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
})

export const batchSetGroupSchema = z.object({
  productIds: z.array(z.string()).min(1),
  groupId: z.string().nullable(),
})

export const assignUngroupedSchema = z.object({
  groupId: z.string().nullable(),
  newGroupName: z.string().min(1).max(50).optional(),
})
