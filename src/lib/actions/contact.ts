'use server'

import { prisma } from '@/lib/db'
import { requireShopUser, requireShopAdmin } from '@/lib/shop-auth'
import { contactSubmissionSchema } from '@/lib/validations/contact'
import { enforceRateLimit } from '@/lib/rate-limit'
import { isHoneypotTripped } from '@/lib/honeypot'
import { assertTurnstileValid } from '@/lib/turnstile'
import type { ApiResponse } from '@/types'
import type { ContactSubmissionStatus } from '@prisma/client'

export async function submitContactForm(data: unknown): Promise<ApiResponse> {
  const rate = await enforceRateLimit('contact-form')
  if (!rate.ok) return { success: false, error: rate.error }

  const parsed = contactSubmissionSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('；') }
  }

  if (isHoneypotTripped(parsed.data as Record<string, unknown>)) {
    return { success: true, message: '提交成功' }
  }

  const captchaError = await assertTurnstileValid(parsed.data.turnstileToken)
  if (captchaError) return captchaError

  const { name, email, phone, message, locale } = parsed.data

  await prisma.contactSubmission.create({
    data: {
      name,
      email,
      phone: phone || null,
      message,
      locale: locale || null,
    },
  })

  return { success: true, message: '提交成功' }
}

export async function getContactSubmissions() {
  await requireShopUser()
  return prisma.contactSubmission.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateContactSubmissionStatus(
  id: string,
  status: ContactSubmissionStatus
): Promise<ApiResponse> {
  try {
    await requireShopAdmin()
    await prisma.contactSubmission.update({ where: { id }, data: { status } })
    return { success: true, message: '状态已更新' }
  } catch {
    return { success: false, error: '更新失败' }
  }
}
