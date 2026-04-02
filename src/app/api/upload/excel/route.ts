import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'

// 临时文件存储目录
const TEMP_DIR = join(process.cwd(), 'public', 'uploads', 'temp')

// 确保临时目录存在
async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true })
  }
}

/**
 * POST /api/upload/excel
 * 上传 Excel 文件并保存到临时目录
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // 3. 验证文件类型（.xlsx, .xls）
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ]
    const allowedExtensions = ['.xlsx', '.xls']
    
    const fileName = file.name.toLowerCase()
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext))
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only .xlsx and .xls files are allowed' },
        { status: 400 }
      )
    }

    // 4. 生成 taskId（UUID）
    const taskId = randomUUID()

    // 5. 保存文件到临时目录
    await ensureTempDir()
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const tempFilePath = join(TEMP_DIR, `${taskId}.xlsx`)
    
    await writeFile(tempFilePath, buffer)

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        taskId,
        fileName: file.name,
      },
    })
  } catch (error) {
    console.error('Failed to upload Excel file:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
