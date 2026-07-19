import { NextRequest, NextResponse } from 'next/server'
import { getCurrentShopUser } from '@/lib/shop-auth'
import { processImage } from '@/lib/image'
import { uploadToR2, generateShopImageKey } from '@/lib/r2'
import type { ApiResponse } from '@/types'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ url: string; thumbnailUrl: string }>>> {
  try {
    const user = await getCurrentShopUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const processed = await processImage(buffer)
    const baseKey = generateShopImageKey('webp')
    const thumbnailKey = baseKey.replace('.webp', '_thumb.webp')

    const [url, thumbnailUrl] = await Promise.all([
      uploadToR2({ key: baseKey, body: processed.original, contentType: 'image/webp' }),
      uploadToR2({ key: thumbnailKey, body: processed.thumbnail, contentType: 'image/webp' }),
    ])

    return NextResponse.json({ success: true, data: { url, thumbnailUrl } })
  } catch (error) {
    console.error('Shop image upload error:', error)
    return NextResponse.json({ success: false, error: 'Failed to upload image' }, { status: 500 })
  }
}
