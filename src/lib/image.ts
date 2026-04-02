import sharp from 'sharp'

export interface ProcessedImage {
  original: Buffer    // webp 格式原图（压缩后）
  thumbnail: Buffer   // 200x200 缩略图
  width: number
  height: number
}

/**
 * 处理上传的图片
 * 1. 转换为 webp 格式
 * 2. 压缩（quality: 80）
 * 3. 限制最大尺寸（宽度不超过 1920px，等比缩放）
 * 4. 生成 200x200 缩略图（cover 裁切）
 * 5. 返回处理后的 buffer 和尺寸信息
 * 
 * @param input 原始图片 Buffer
 * @returns 处理后的图片信息
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  // 首先获取原始图片尺寸
  const metadata = await sharp(input).metadata()
  const originalWidth = metadata.width || 0
  const originalHeight = metadata.height || 0

  // 计算缩放后的尺寸（保持比例，最大宽度 1920）
  let targetWidth = originalWidth
  let targetHeight = originalHeight
  const MAX_WIDTH = 1920

  if (originalWidth > MAX_WIDTH) {
    targetWidth = MAX_WIDTH
    targetHeight = Math.round((originalHeight * MAX_WIDTH) / originalWidth)
  }

  // 处理原图：转换为 webp，压缩，限制尺寸
  const processedBuffer = await sharp(input)
    .resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer()

  // 生成缩略图：200x200，cover 裁切
  const thumbnailBuffer = await sharp(input)
    .resize(200, 200, {
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 80 })
    .toBuffer()

  return {
    original: processedBuffer,
    thumbnail: thumbnailBuffer,
    width: targetWidth,
    height: targetHeight,
  }
}

/**
 * 从 Buffer 获取图片元信息
 * 
 * @param input 图片 Buffer
 * @returns 图片元信息
 */
export async function getImageMetadata(input: Buffer): Promise<{
  width: number
  height: number
  format: string
}> {
  const metadata = await sharp(input).metadata()
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
  }
}
