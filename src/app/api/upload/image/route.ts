import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { processImage } from '@/lib/image'
import { uploadToR2, generateFileKey } from '@/lib/r2'
import type { ApiResponse } from '@/types'

// 允许的图片类型
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

// 最大文件大小：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * POST /api/upload/image
 * 上传图片接口（仅 ADMIN 可用）
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ url: string; thumbnailUrl: string }>>> {
  try {
    // 1. 验证用户身份
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // 2. 从 FormData 获取 file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // 3. 验证文件类型
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      )
    }

    // 4. 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size: 10MB' },
        { status: 400 }
      )
    }

    // 读取文件为 Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 5. 处理图片
    const processed = await processImage(buffer)

    // 6. 生成文件 key
    const baseKey = generateFileKey('products', 'webp')
    const thumbnailKey = baseKey.replace('.webp', '_thumb.webp')

    // 7. 上传原图和缩略图到 R2
    const [url, thumbnailUrl] = await Promise.all([
      uploadToR2({
        key: baseKey,
        body: processed.original,
        contentType: 'image/webp',
      }),
      uploadToR2({
        key: thumbnailKey,
        body: processed.thumbnail,
        contentType: 'image/webp',
      }),
    ])

    // 8. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        url,
        thumbnailUrl,
      },
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
