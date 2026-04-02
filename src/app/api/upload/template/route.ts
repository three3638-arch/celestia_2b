import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/upload/template
 * 下载商品导入模板文件
 */
export async function GET() {
  try {
    // 1. 验证 ADMIN 权限
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. 读取模板文件
    const templatePath = join(process.cwd(), 'docs', 'import-template.xlsx')
    const fileBuffer = await readFile(templatePath)

    // 3. 返回文件响应
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="import-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('Failed to download template:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download template' },
      { status: 500 }
    )
  }
}
