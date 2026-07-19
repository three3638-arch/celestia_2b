import { z } from 'zod'
import { HONEYPOT_FIELD } from '@/lib/honeypot'

export const contactSubmissionSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(5).optional().or(z.literal('')),
  message: z.string().min(10),
  locale: z.string().optional(),
  [HONEYPOT_FIELD]: z.string().optional(),
  turnstileToken: z.string().optional(),
})
