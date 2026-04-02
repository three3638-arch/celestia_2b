import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { signToken, setAuthCookie } from '@/lib/auth'
import { registerSchema } from '@/lib/validations/auth'
import type { ApiResponse, SessionUser } from '@/types'

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SessionUser>>> {
  try {
    const body = await request.json()
    
    // 验证请求体
    const result = registerSchema.safeParse(body)
    if (!result.success) {
      const errors = result.error.issues.map(i => i.message).join('；')
      return NextResponse.json(
        { success: false, error: errors },
        { status: 400 }
      )
    }
    
    const { phone, password, name, company } = result.data
    
    // 检查手机号是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    })
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Phone number already registered' },
        { status: 409 }
      )
    }
    
    // 密码加密
    const passwordHash = await hashPassword(password)
    
    // 创建用户
    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        name,
        company: company || null,
        role: 'CUSTOMER',
        status: 'PENDING',
      },
      select: {
        id: true,
        phone: true,
        name: true,
        company: true,
        role: true,
        status: true,
        markupRatio: true,
        preferredLang: true,
      },
    })
    
    // 签发 JWT 并设置 cookie
    const token = await signToken({ userId: user.id, role: user.role, status: user.status })
    await setAuthCookie(token)
    
    // 返回用户信息
    const sessionUser: SessionUser = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      company: user.company,
      role: user.role,
      status: user.status,
      markupRatio: user.markupRatio.toString(),
      preferredLang: user.preferredLang,
    }
    
    return NextResponse.json(
      { success: true, data: sessionUser, message: 'Registration successful' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
