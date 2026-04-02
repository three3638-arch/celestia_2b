import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

// R2 客户端配置
// Cloudflare R2 使用 S3 兼容 API
// endpoint: https://{ACCOUNT_ID}.r2.cloudflarestorage.com

const isR2Configured = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY
)

// 仅在 R2 配置存在时创建客户端
let r2Client: S3Client | null = null
if (isR2Configured) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'celestia'
const PUBLIC_URL = process.env.R2_PUBLIC_URL || ''

/**
 * 上传文件到 R2
 * @param params 上传参数
 * @returns 返回公开 URL
 */
export async function uploadToR2(params: {
  key: string       // 存储路径，如 products/xxx.webp
  body: Buffer
  contentType: string
}): Promise<string> {
  const { key, body, contentType } = params

  // 如果 R2 未配置，保存到本地
  if (!r2Client) {
    return uploadToLocal(key, body)
  }

  // 上传到 R2
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await r2Client.send(command)

  // 返回公开 URL
  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${key}`
  }

  // 如果没有配置公开 URL，使用 R2 默认 URL
  return `https://${BUCKET_NAME}.r2.cloudflarestorage.com/${key}`
}

/**
 * 本地开发 fallback：保存文件到 public/uploads
 */
async function uploadToLocal(key: string, body: Buffer): Promise<string> {
  const uploadDir = join(process.cwd(), 'public', 'uploads')
  const filePath = join(uploadDir, key)
  const dirPath = join(filePath, '..')

  // 确保目录存在
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true })
  }

  await writeFile(filePath, body)

  // 返回本地 URL
  return `/uploads/${key}`
}

/**
 * 删除 R2 文件
 * @param key 文件 key
 */
export async function deleteFromR2(key: string): Promise<void> {
  // 如果 R2 未配置，删除本地文件
  if (!r2Client) {
    const { unlink } = await import('fs/promises')
    const filePath = join(process.cwd(), 'public', 'uploads', key)
    try {
      await unlink(filePath)
    } catch {
      // 文件不存在时忽略错误
    }
    return
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

/**
 * 生成文件 key（基于时间戳 + 随机字符串，避免冲突）
 * @param prefix 前缀，如 products
 * @param extension 扩展名，如 webp
 * @returns 文件 key，如 products/1711648000000-a3f2.webp
 */
export function generateFileKey(prefix: string, extension: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 6)
  return `${prefix}/${timestamp}-${random}.${extension}`
}
