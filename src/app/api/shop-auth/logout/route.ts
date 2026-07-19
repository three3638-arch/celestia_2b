import { NextResponse } from 'next/server'
import { clearShopAuthCookie } from '@/lib/shop-auth'
import type { ApiResponse } from '@/types'

export async function POST(): Promise<NextResponse<ApiResponse>> {
  await clearShopAuthCookie()
  return NextResponse.json({ success: true, message: '已退出登录' })
}
