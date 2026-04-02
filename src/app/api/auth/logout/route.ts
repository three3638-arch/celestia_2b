import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export async function POST(): Promise<NextResponse<ApiResponse<null>>> {
  try {
    // 清除认证 cookie
    await clearAuthCookie()
    
    return NextResponse.json(
      { success: true, message: 'Logout successful' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
