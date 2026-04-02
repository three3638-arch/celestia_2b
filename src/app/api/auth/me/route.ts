import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse<{ user: { name: string; phone: string; company: string | null } } | null>>> {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        success: true, 
        data: { 
          user: {
            name: user.name,
            phone: user.phone,
            company: user.company,
          }
        } 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get user info error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
