import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signToken, setAuthCookie } from '@/lib/auth'
import { loginSchema } from '@/lib/validations/auth'
import type { ApiResponse, SessionUser } from '@/types'
import type { UserStatus } from '@prisma/client'

interface LoginResponseData extends SessionUser {
  status: UserStatus
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<LoginResponseData>>> {
  try {
    const body = await request.json()
    
    // 验证请求体
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      const errors = result.error.issues.map(i => i.message).join('；')
      return NextResponse.json(
        { success: false, error: errors },
        { status: 400 }
      )
    }
    
    const { phone, password } = result.data
    
    // 查询用户
    const user = await prisma.user.findUnique({
      where: { phone },
    })
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }
    
    // 验证密码
    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number or password' },
        { status: 401 }
      )
    }
    
    // 签发 JWT 并设置 cookie
    const token = await signToken({ userId: user.id, role: user.role, status: user.status })
    await setAuthCookie(token)
    
    // 返回用户信息 + 状态
    const responseData: LoginResponseData = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      company: user.company,
      role: user.role,
      markupRatio: user.markupRatio.toString(),
      preferredLang: user.preferredLang,
      status: user.status,
    }
    
    return NextResponse.json(
      { success: true, data: responseData, message: 'Login successful' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
